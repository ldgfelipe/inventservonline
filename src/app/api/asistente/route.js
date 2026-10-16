import { error, sesion, exigir, auditar, evento, manejar } from '@/lib/auth';
import { interpretar } from '@/services/nlu';
import { clave, similitud } from '@/services/texto';
import { puede } from '@/services/permisos';
import { formatearMoneda } from '@/lib/monedas';

export const runtime = 'nodejs';

/* ============================================================
   Asistente online. Reutiliza el MISMO motor de intenciones que la
   version de escritorio (src/services/nlu.js), asi que entiende las
   mismas frases; lo unico que cambia es de donde salen los datos.
   ============================================================ */

const UMBRAL = 0.55;

function tokensUtiles(nombre) {
  return clave(nombre).split(' ').filter((t) => t.length >= 4 && !/^[\d.,]+[a-z]{0,3}$/.test(t));
}

async function buscarProducto(sb, empresaId, texto, usuarioId) {
  const { data: alias } = await sb.from('asistente_alias')
    .select('frase, producto_id, productos(nombre, codigo, stock_actual)')
    .eq('empresa_id', empresaId).eq('usuario_id', usuarioId);

  for (const a of alias || []) {
    if (clave(a.frase) && texto.includes(clave(a.frase))) {
      return { encontrado: true, producto: { id: a.producto_id, ...a.productos }, origen: 'alias' };
    }
  }

  const { data: productos } = await sb.from('productos')
    .select('id, codigo, nombre, stock_actual').eq('empresa_id', empresaId).eq('activo', true);
  if (!productos || !productos.length) return { encontrado: false, vacio: true };

  const puntuados = productos.map((p) => {
    let puntos = 0;
    const kn = clave(p.nombre);
    if (kn && texto.includes(kn)) puntos = 1;
    else {
      const tokens = tokensUtiles(p.nombre);
      if (tokens.length) puntos = (tokens.filter((t) => texto.includes(t)).length / tokens.length) * 0.9;
      if (puntos < 0.5) puntos = Math.max(puntos, similitud(texto, p.nombre) * 0.85);
    }
    return { producto: p, puntaje: puntos };
  }).filter((p) => p.puntaje > 0).sort((a, b) => b.puntaje - a.puntaje);

  if (!puntuados.length || puntuados[0].puntaje < UMBRAL) return { encontrado: false };
  return { encontrado: true, producto: puntuados[0].producto, origen: 'tokens' };
}

/* -- Formato de las respuestas del asistente --------------------------------

   El renderer espera { ok, intencion, texto, tablas, acciones }:
   - `tablas`  arreglo de { titulo, columnas:[{campo,titulo}], filas }
   - `acciones` arreglo de botones { id, etiqueta, tipo, ... }

   Estos dos ayudantes existian en la version de escritorio; al portar la
   ruta a la web se quedaron fuera y el asistente fallaba con
   "responder is not defined". Se recuperan aqui. */
function tabla(titulo, filas, campos, encabezados) {
  return {
    titulo,
    columnas: (campos || []).map((campo, i) => ({
      campo,
      titulo: (encabezados && encabezados[i]) || campo,
    })),
    filas: filas || [],
  };
}

function responder(p, texto, extra) {
  const tablas = [];
  let acciones = [];
  if (Array.isArray(extra)) acciones = extra;
  else if (extra && typeof extra === 'object' && extra.columnas) tablas.push(extra);

  return {
    ok: true,
    intencion: (p && p.intencion) || 'desconocido',
    texto,
    tablas,
    acciones,
  };
}

/* POST /api/asistente { texto } */
async function procesar(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  let cuerpo;
  try { cuerpo = await request.json(); } catch { cuerpo = {}; }

  // La moneda con la que se muestran los importes. Si la base aun no
  // tiene la migracion 012, la consulta falla y quedamos en VES.
  const { data: empresaFila } = await sb.from('empresas')
    .select('moneda').eq('id', perfil.empresa_id).maybeSingle();
  const moneda = (n) => formatearMoneda(n, (empresaFila && empresaFila.moneda) || 'VES');

  const texto = String(cuerpo.texto || '').trim();
  if (!texto) return error('Escribe tu consulta');

  const paso = Number(cuerpo.paso || 0);
  if (paso === 1) return Response.json({ ok: true, diag: 'tras leer texto', texto });

  const p = interpretar(texto);
  if (paso === 2) return Response.json({ ok: true, diag: 'interpretar ok', intencion: p.intencion });

  await evento(sb, perfil, 'asistente.consulta', p.intencion);
  if (paso === 3) return Response.json({ ok: true, diag: 'evento ok' });

  const prueba = responder(p, 'prueba', [{ id: 'x', etiqueta: 'X', tipo: 'ayuda' }]);
  if (paso === 4) return Response.json({ ok: true, diag: 'responder ok', prueba });

  const negar = (permiso) => ({
    ok: true, intencion: p.intencion,
    texto: `No tienes permiso para esta informacion (${permiso}). Pide acceso a un administrador.`,
    acciones: [],
  });

  try {
    switch (p.intencion) {
      case 'saludo':
        return responder(p, `Hola ${perfil.nombre.split(' ')[0]}. Puedes preguntarme por el stock, lo que esta por agotarse o pedir registrar una entrada o salida.`,
          [{ id: 'ayuda', etiqueta: 'Ver que puedo hacer', tipo: 'ayuda' }]);

      case 'listar_bajo': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data } = await sb.from('productos')
          .select('codigo, nombre, stock_actual, stock_minimo')
          .eq('empresa_id', perfil.empresa_id).eq('activo', true)
          .gt('stock_actual', 0).lte('stock_minimo', 'stock_actual')
          .order('stock_actual').limit(50);
        return responder(p, data && data.length
          ? `Hay ${data.length} producto(s) en o por debajo del minimo:`
          : 'Ningun producto esta por debajo del minimo. Todo en orden.',
          tabla('Stock bajo', data || [], ['codigo', 'nombre', 'stock_actual', 'stock_minimo'], ['Codigo', 'Producto', 'Actual', 'Minimo']));
      }

      case 'listar_agotados': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data } = await sb.from('productos')
          .select('codigo, nombre, stock_actual')
          .eq('empresa_id', perfil.empresa_id).eq('activo', true)
          .lte('stock_actual', 0).order('nombre').limit(50);
        return responder(p, data && data.length
          ? `${data.length} producto(s) agotados:`
          : 'No hay productos agotados.',
          tabla('Agotados', data || [], ['codigo', 'nombre', 'stock_actual'], ['Codigo', 'Producto', 'Stock']));
      }

      case 'valor_inventario':
      case 'conteo_total': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data } = await sbRpc.rpc('metricas_dashboard');
        return responder(p, `Tienes ${data.productos} productos activos con ${data.unidades} unidades en total, valorizados en ${moneda(data.valor)}.`);
      }

      case 'top_movidos': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sbRpc.rpc('top_movidos', { p_limite: 10 });
        return responder(p, data && data.length ? 'Productos con mas movimiento:' : 'Aun no hay movimientos registrados.',
          tabla('Mas movidos', data || [], ['nombre', 'movimientos', 'entradas', 'salidas'], ['Producto', 'Movs', 'Entradas', 'Salidas']));
      }

      case 'consultar_stock':
      case 'info_producto': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const r = await buscarProducto(sb, perfil.empresa_id, p.textoPlano, perfil.id);
        if (!r.encontrado) {
          return responder(p, r.vacio
            ? 'Todavia no hay productos cargados. Puedes importarlos desde un archivo.'
            : 'No encontre ese producto. Escribe su nombre o codigo.',
            r.vacio ? [{ id: 'importar', etiqueta: 'Importar productos', tipo: 'abrir_importador' }] : []);
        }
        const { data: prod } = await sb.from('productos')
          .select('*, categorias(nombre), proveedores(nombre)')
          .eq('empresa_id', perfil.empresa_id).eq('id', r.producto.id).maybeSingle();
        const detalle = [
          `Stock actual: ${prod.stock_actual} unidades`,
          `Minimo: ${prod.stock_minimo}`,
          `Precio de venta: ${moneda(prod.precio_venta)}`,
          prod.categorias ? `Categoria: ${prod.categorias.nombre}` : null,
          prod.proveedores ? `Proveedor: ${prod.proveedores.nombre}` : null,
          prod.stock_actual === 0 ? 'Esta agotado' : (prod.stock_actual <= prod.stock_minimo ? 'Esta por debajo del minimo' : null),
        ].filter(Boolean);
        return responder(p, `${prod.nombre}${prod.codigo ? ' (' + prod.codigo + ')' : ''}:\n${detalle.join('\n')}`,
          [{ id: 'trazar', etiqueta: 'Ver trazabilidad', tipo: 'trazar', productoId: r.producto.id }]);
      }

      case 'registrar_entrada':
      case 'registrar_salida': {
        const esEntrada = p.intencion === 'registrar_entrada';
        const permiso = esEntrada ? 'movimientos.entrada' : 'movimientos.salida';
        if (!puede(perfil.rol, permiso)) return responder(p, negar(permiso).texto);

        const r = await buscarProducto(sb, perfil.empresa_id, p.textoPlano, perfil.id);
        if (!r.encontrado) {
          return responder(p, 'No encontre el producto. Escribe su nombre o codigo para registrar la ' + (esEntrada ? 'entrada' : 'salida') + '.');
        }
        if (!p.cantidad) {
          return responder(p, `¿Cuantas unidades de ${r.producto.nombre} vas a ${esEntrada ? 'ingresar' : 'retirar'}?`,
            [1, 5, 10].map((n) => ({ id: 'c' + n, etiqueta: String(n), tipo: 'cantidad', productoId: r.producto.id, tipoMov: esEntrada ? 'entrada' : 'salida', cantidad: n })));
        }
        const { data: prod } = await sb.from('productos').select('nombre, stock_actual')
          .eq('empresa_id', perfil.empresa_id).eq('id', r.producto.id).maybeSingle();
        if (!esEntrada && p.cantidad.valor > prod.stock_actual) {
          return responder(p, `No hay suficiente: ${prod.nombre} tiene ${prod.stock_actual} unidades y quieres retirar ${p.cantidad.valor}.`);
        }
        return responder(p,
          `Vas a registrar ${p.cantidad.valor} unidad(es) de ${prod.nombre} como ${esEntrada ? 'ENTRADA' : 'SALIDA'} (stock actual ${prod.stock_actual}). ¿Confirmas?`,
          [{ id: 'ok', etiqueta: 'Confirmar ' + (esEntrada ? 'entrada' : 'salida'), tipo: 'confirmar_movimiento',
             productoId: r.producto.id, productoNombre: prod.nombre, tipoMov: esEntrada ? 'entrada' : 'salida', cantidad: p.cantidad.valor }]);
      }

      case 'crear_producto':
        if (!puede(perfil.rol, 'productos.crear')) return responder(p, negar('productos.crear').texto);
        return responder(p, 'Para crear un producto completo usa el formulario de Productos.',
          [{ id: 'nuevo', etiqueta: 'Abrir formulario', tipo: 'nuevo_producto' }]);

      case 'usar_importador':
        if (!puede(perfil.rol, 'productos.crear')) return responder(p, negar('productos.crear').texto);
        return responder(p, 'Puedes cargar productos masivamente desde un CSV o Excel. Reviso las columnas, detecto duplicados y te muestro una vista previa antes de aplicar.',
          [{ id: 'importar', etiqueta: 'Abrir importador', tipo: 'abrir_importador' }]);

      case 'ayuda':
        return responder(p, 'Puedo ayudarte con: stock de un producto, productos con stock bajo, agotados, valor total del inventario, movimientos por persona, y registrar entradas o salidas. Escribe algo como "cuanto cemento tengo".');

      default:
        return responder(p, 'No entendi eso. Prueba con "¿cuanto cemento tengo?", "stock bajo" o "registrar entrada de 50 de cemento".',
          [{ id: 'ayuda', etiqueta: 'Ver que puedo hacer', tipo: 'ayuda' }]);
    }
  } catch (err) {
    return responder(p, 'Ocurrio un error al consultar: ' + err.message);
  }
}

/* Envoltura de diagnostico: si algo falla, devuelve el error real en el
   cuerpo (en produccion se revierte a un mensaje generico). */
async function consultar(request) {
  try {
    return await procesar(request);
  } catch (err) {
    console.error('[asistente] fallo:', err);
    return Response.json(
      { ok: false, error: 'ASISTENTE_DIAG: ' + String((err && err.stack) || err) },
      { status: 500 },
    );
  }
}

export const POST = manejar(consultar);

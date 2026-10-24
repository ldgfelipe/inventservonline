import { error, sesion, exigir, auditar, evento, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';
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

function formatoFecha(f) {
  if (!f) return '-';
  return String(f).replace('T', ' ').slice(0, 16);
}

function tokensUtiles(nombre) {
  return clave(nombre).split(' ').filter((t) => t.length >= 4 && !/^[\d.,]+[a-z]{0,3}$/.test(t));
}

async function buscarProducto(sb, empresaId, texto, usuarioId) {
  const { data: alias } = await sb.from('asistente_alias')
    .select('frase, producto_id, productos(nombre, codigo, stock_actual, stock_minimo, stock_maximo)')
    .eq('empresa_id', empresaId).eq('usuario_id', usuarioId);

  for (const a of alias || []) {
    if (clave(a.frase) && texto.includes(clave(a.frase))) {
      return { encontrado: true, producto: { id: a.producto_id, ...a.productos }, origen: 'alias' };
    }
  }

  const { data: productos } = await sb.from('productos')
    .select('id, codigo, nombre, stock_actual, stock_minimo, stock_maximo').eq('empresa_id', empresaId).eq('activo', true);
  if (!productos || !productos.length) return { encontrado: false, vacio: true };

  const puntuados = productos.map((p) => {
    let puntos = 0;
    const kc = clave(p.codigo);
    const kn = clave(p.nombre);
    if (kc && texto.includes(kc)) puntos = 1;
    else if (kn && texto.includes(kn)) puntos = 1;
    else {
      const tokens = tokensUtiles(p.nombre);
      if (tokens.length) {
        // Un token util que aparece en la frase ya es una senal fuerte:
        // partimos de 0.6 y subimos segun cuantos tokens coincidan, para
        // que "cuanto arroz tengo" encuentre "Arroz blanco 1Kg".
        const coinciden = tokens.filter((t) => texto.includes(t)).length;
        if (coinciden) puntos = 0.6 + (coinciden / tokens.length) * 0.4;
      }
      if (puntos < 0.5) puntos = Math.max(puntos, similitud(texto, p.nombre) * 0.85);
    }
    return { producto: p, puntaje: puntos };
  }).filter((p) => p.puntaje > 0).sort((a, b) => b.puntaje - a.puntaje);

  if (!puntuados.length || puntuados[0].puntaje < UMBRAL) return { encontrado: false };
  return { encontrado: true, producto: puntuados[0].producto, origen: 'tokens' };
}

/* Extrae todos los numeros de una frase (para minimos/maximos). */
function numerosDe(texto) {
  return (String(texto).match(/\d+(?:[.,]\d+)?/g) || [])
    .map((n) => Number(n.replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

/* Ventas confirmadas agregadas por producto (unidades, ingresos, costo, margen). */
async function ventasPorProducto(sb, empresaId) {
  const { data: ventas } = await sb.from('ventas')
    .select('id').eq('empresa_id', empresaId).eq('estado', 'confirmada');
  const ids = (ventas || []).map((v) => v.id);
  if (!ids.length) return [];
  const { data: det } = await sb.from('venta_detalle')
    .select('producto_id, cantidad, subtotal, costo_unitario, almacen_id, productos(nombre, codigo, proveedor_id)')
    .in('venta_id', ids);
  const mapa = {};
  for (const d of det || []) {
    const id = d.producto_id;
    if (!id) continue;
    if (!mapa[id]) {
      mapa[id] = {
        producto_id: id,
        nombre: d.productos ? d.productos.nombre : '-',
        codigo: d.productos ? d.productos.codigo : '',
        proveedor_id: d.productos ? d.productos.proveedor_id : null,
        unidades: 0, ingresos: 0, costo: 0,
      };
    }
    mapa[id].unidades += Number(d.cantidad) || 0;
    mapa[id].ingresos += Number(d.subtotal) || 0;
    mapa[id].costo += (Number(d.cantidad) || 0) * (Number(d.costo_unitario) || 0);
  }
  return Object.values(mapa).map((x) => ({
    ...x,
    ganancia: x.ingresos - x.costo,
    margen: x.ingresos > 0 ? ((x.ingresos - x.costo) / x.ingresos) * 100 : 0,
  }));
}

/* Ventas confirmadas agregadas por almacen. */
async function ventasPorAlmacen(sb, empresaId) {
  const { data: ventas } = await sb.from('ventas')
    .select('id').eq('empresa_id', empresaId).eq('estado', 'confirmada');
  const ids = (ventas || []).map((v) => v.id);
  if (!ids.length) return [];
  const { data: det } = await sb.from('venta_detalle')
    .select('cantidad, subtotal, almacen_id').in('venta_id', ids);
  const mapa = {};
  for (const d of det || []) {
    const id = d.almacen_id || 'sin';
    if (!mapa[id]) mapa[id] = { almacen_id: id, unidades: 0, ingresos: 0 };
    mapa[id].unidades += Number(d.cantidad) || 0;
    mapa[id].ingresos += Number(d.subtotal) || 0;
  }
  return Object.values(mapa);
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

  /* OJO: una ruta de App Router debe devolver un `Response`. Si devolvemos
     un objeto plano, Next no puede responder y el cliente recibe un 500
     con el cuerpo vacio. Por eso envolvemos con Response.json. */
  return Response.json({
    ok: true,
    intencion: (p && p.intencion) || 'desconocido',
    texto,
    tablas,
    acciones,
  });
}

/* POST /api/asistente { texto } */
async function consultar(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  // Verificar modulo asistente
  try { await exigirModulo(sb, perfil, 'asistente'); } catch (e) { return e.respuesta(); }
  let cuerpo;
  try { cuerpo = await request.json(); } catch { cuerpo = {}; }

  // La moneda con la que se muestran los importes. Si la base aun no
  // tiene la migracion 012, la consulta falla y quedamos en VES.
  const { data: empresaFila } = await sb.from('empresas')
    .select('moneda').eq('id', perfil.empresa_id).maybeSingle();
  const moneda = (n) => formatearMoneda(n, (empresaFila && empresaFila.moneda) || 'VES');

  const texto = String(cuerpo.texto || '').trim();
  if (!texto) return error('Escribe tu consulta');

  const p = interpretar(texto);
  await evento(sb, perfil, 'asistente.consulta', p.intencion);

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
        // PostgREST no compara columnas entre si, asi que traemos los
        // productos activos y filtramos en memoria: actual <= minimo.
        // Se incluyen los que estan en 0 (los mas urgentes de pedir).
        const { data } = await sb.from('productos')
          .select('codigo, nombre, stock_actual, stock_minimo')
          .eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const bajos = (data || [])
          .filter((x) => Number(x.stock_actual) <= Number(x.stock_minimo))
          .map((x) => ({
            ...x,
            faltan: Math.max(0, Number(x.stock_minimo) - Number(x.stock_actual)),
          }))
          .sort((a, b) => Number(a.stock_actual) - Number(b.stock_actual)).slice(0, 50);
        return responder(p, bajos.length
          ? `Estos son los ${bajos.length} productos que necesitas reponer (de menor a mayor existencia):`
          : 'No hay productos por debajo del minimo. No necesitas pedir nada por ahora.',
          tabla('Productos por reponer', bajos,
            ['codigo', 'nombre', 'stock_actual', 'stock_minimo', 'faltan'],
            ['Codigo', 'Producto', 'Actual', 'Minimo', 'Faltan']));
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

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
      }

      case 'ventas_recientes': {
        if (!puede(perfil.rol, 'ventas.ver')) return responder(p, negar('ventas.ver').texto);
        const { data } = await sb.from('ventas')
          .select('numero, fecha, total, clientes(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((v) => ({ numero: v.numero, fecha: formatoFecha(v.fecha), cliente: v.clientes ? v.clientes.nombre : 'Mostrador', total: moneda(v.total) }));
        return responder(p, (data && data.length) ? `Ultimas ${data.length} ventas:` : 'Aun no hay ventas registradas.',
          tabla('Ventas recientes', filas, ['numero', 'fecha', 'cliente', 'total'], ['Numero', 'Fecha', 'Cliente', 'Total']));
      }

      case 'cxc_pendientes': {
        if (!puede(perfil.rol, 'cxc.ver')) return responder(p, negar('cxc.ver').texto);
        const { data } = await sb.from('cuentas_por_cobrar')
          .select('saldo, estado, clientes(nombre), ventas(numero)')
          .eq('empresa_id', perfil.empresa_id).in('estado', ['pendiente', 'parcial'])
          .order('created_at', { ascending: false }).limit(20);
        const filas = (data || []).map((c) => ({ cliente: c.clientes ? c.clientes.nombre : '-', venta: c.ventas ? c.ventas.numero : '-', saldo: moneda(c.saldo), estado: c.estado }));
        const total = (data || []).reduce((a, c) => a + Number(c.saldo), 0);
        return responder(p, (data && data.length) ? `Cuentas por cobrar pendientes (${moneda(total)}):` : 'No hay cuentas por cobrar pendientes.',
          tabla('CxC pendientes', filas, ['cliente', 'venta', 'saldo', 'estado'], ['Cliente', 'Venta', 'Saldo', 'Estado']));
      }

      case 'cxp_pendientes': {
        if (!puede(perfil.rol, 'cxp.ver')) return responder(p, negar('cxp.ver').texto);
        const { data } = await sb.from('cuentas_por_pagar')
          .select('saldo, estado, proveedores(nombre), compras(numero)')
          .eq('empresa_id', perfil.empresa_id).in('estado', ['pendiente', 'parcial'])
          .order('created_at', { ascending: false }).limit(20);
        const filas = (data || []).map((c) => ({ proveedor: c.proveedores ? c.proveedores.nombre : '-', compra: c.compras ? c.compras.numero : '-', saldo: moneda(c.saldo), estado: c.estado }));
        const total = (data || []).reduce((a, c) => a + Number(c.saldo), 0);
        return responder(p, (data && data.length) ? `Cuentas por pagar pendientes (${moneda(total)}):` : 'No hay cuentas por pagar pendientes.',
          tabla('CxP pendientes', filas, ['proveedor', 'compra', 'saldo', 'estado'], ['Proveedor', 'Compra', 'Saldo', 'Estado']));
      }

      case 'caja_hoy': {
        if (!puede(perfil.rol, 'caja.ver')) return responder(p, negar('caja.ver').texto);
        const hoy = new Date().toISOString().slice(0, 10);
        const { data } = await sb.from('cobros')
          .select('monto, metodo').eq('empresa_id', perfil.empresa_id)
          .gte('fecha', hoy + 'T00:00:00').lte('fecha', hoy + 'T23:59:59');
        const total = (data || []).reduce((a, c) => a + Number(c.monto), 0);
        const porMetodo = {};
        for (const c of data || []) porMetodo[c.metodo] = (porMetodo[c.metodo] || 0) + Number(c.monto);
        const texto = `Caja de hoy: ${moneda(total)} en ${(data || []).length} cobros.` +
          (Object.keys(porMetodo).length ? ' ' + Object.entries(porMetodo).map(([k, v]) => `${k}: ${moneda(v)}`).join(', ') + '.' : '');
        return responder(p, texto);
      }

      case 'margen': {
        if (!puede(perfil.rol, 'reportes.ver')) return responder(p, negar('reportes.ver').texto);
        const { data: ventas } = await sb.from('ventas')
          .select('id, total').eq('empresa_id', perfil.empresa_id).eq('estado', 'confirmada');
        const ids = (ventas || []).map((v) => v.id);
        let costos = 0;
        if (ids.length) {
          const { data: det } = await sb.from('venta_detalle')
            .select('cantidad, costo_unitario').in('venta_id', ids);
          costos = (det || []).reduce((a, d) => a + Number(d.cantidad) * Number(d.costo_unitario), 0);
        }
        const total = (ventas || []).reduce((a, v) => a + Number(v.total), 0);
        const margen = total - costos;
        const pct = total > 0 ? (margen / total) * 100 : 0;
        return responder(p, `Ventas confirmadas: ${moneda(total)}. Costo: ${moneda(costos)}. Margen: ${moneda(margen)} (${pct.toFixed(1)}%).`);
      }

      case 'mas_vendidos': {
        if (!puede(perfil.rol, 'ventas.ver')) return responder(p, negar('ventas.ver').texto);
        const datos = await ventasPorProducto(sb, perfil.empresa_id);
        if (!datos.length) return responder(p, 'Aun no hay ventas confirmadas para calcular los mas vendidos.');
        const top = datos.sort((a, b) => b.ingresos - a.ingresos).slice(0, 20);
        const filas = top.map((x) => ({
          producto: x.nombre,
          unidades: x.unidades,
          ingresos: moneda(x.ingresos),
          ganancia: moneda(x.ganancia),
          margen: x.margen.toFixed(1) + '%',
        }));
        return responder(p, 'Productos mas vendidos por ingresos:',
          tabla('Mas vendidos', filas,
            ['producto', 'unidades', 'ingresos', 'ganancia', 'margen'],
            ['Producto', 'Unidades', 'Ingresos', 'Ganancia', 'Margen %']));
      }

      case 'productos_estancados': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: prods } = await sb.from('productos')
          .select('id, codigo, nombre, stock_actual, created_at')
          .eq('empresa_id', perfil.empresa_id).eq('activo', true).gt('stock_actual', 0);
        if (!prods || !prods.length) return responder(p, 'No hay productos con stock para analizar.');
        const { data: movs } = await sb.from('movimientos')
          .select('producto_id, fecha').eq('empresa_id', perfil.empresa_id);
        const ultimo = {};
        const conteo = {};
        for (const m of movs || []) {
          conteo[m.producto_id] = (conteo[m.producto_id] || 0) + 1;
          if (!ultimo[m.producto_id] || new Date(m.fecha) > new Date(ultimo[m.producto_id])) {
            ultimo[m.producto_id] = m.fecha;
          }
        }
        const hoy = Date.now();
        const filas = prods.map((pr) => {
          const ult = ultimo[pr.id] || pr.created_at;
          const dias = Math.max(0, Math.floor((hoy - new Date(ult).getTime()) / 86400000));
          return {
            producto: pr.nombre,
            codigo: pr.codigo || '-',
            stock: pr.stock_actual,
            movimientos: conteo[pr.id] || 0,
            dias_sin_mover: dias,
            ingreso: String(pr.created_at || '').slice(0, 10),
          };
        }).filter((x) => x.movimientos <= 3 || x.dias_sin_mover >= 30)
          .sort((a, b) => b.dias_sin_mover - a.dias_sin_mover)
          .slice(0, 25);
        return responder(p, filas.length
          ? 'Estos productos tienen stock y casi no se mueven. Considera promociones o dejar de comprarlos:'
          : 'Todos los productos con stock tienen movimiento reciente. No hay estancados.',
          tabla('Productos estancados', filas,
            ['producto', 'codigo', 'stock', 'movimientos', 'dias_sin_mover', 'ingreso'],
            ['Producto', 'Codigo', 'Stock', 'Movs', 'Dias sin mover', 'Ingreso']));
      }

      case 'proveedores_compras': {
        if (!puede(perfil.rol, 'compras.ver')) return responder(p, negar('compras.ver').texto);
        const { data: compras } = await sb.from('compras')
          .select('proveedor_id, total, fecha, proveedores(nombre)')
          .eq('empresa_id', perfil.empresa_id).neq('estado', 'anulada');
        const { data: det } = await sb.from('compra_detalle')
          .select('cantidad, compras(proveedor_id, estado)')
          .eq('empresa_id', perfil.empresa_id);
        const mapa = {};
        const filaProv = (id, nombre) => {
          const k = id || 'sin';
          if (!mapa[k]) mapa[k] = { proveedor: nombre || 'Sin proveedor', compras: 0, invertido: 0, unidades: 0, ultima: null };
          if (nombre && mapa[k].proveedor === 'Sin proveedor') mapa[k].proveedor = nombre;
          return mapa[k];
        };
        for (const c of compras || []) {
          const f = filaProv(c.proveedor_id, c.proveedores ? c.proveedores.nombre : null);
          f.compras++;
          f.invertido += Number(c.total) || 0;
          if (!f.ultima || new Date(c.fecha) > new Date(f.ultima)) f.ultima = c.fecha;
        }
        for (const d of det || []) {
          if (d.compras && d.compras.estado === 'anulada') continue;
          const provId = d.compras ? d.compras.proveedor_id : null;
          filaProv(provId, null).unidades += Number(d.cantidad) || 0;
        }
        const filas = Object.values(mapa)
          .sort((a, b) => b.invertido - a.invertido)
          .map((x) => ({
            proveedor: x.proveedor,
            compras: x.compras,
            unidades: Math.round(x.unidades * 100) / 100,
            invertido: moneda(x.invertido),
            ultima: String(x.ultima || '').slice(0, 10),
          }));
        return responder(p, filas.length
          ? 'Compras por proveedor (de mayor a menor inversion):'
          : 'Aun no hay compras registradas.',
          tabla('Compras por proveedor', filas,
            ['proveedor', 'compras', 'unidades', 'invertido', 'ultima'],
            ['Proveedor', 'Compras', 'Unidades', 'Invertido', 'Ultima']));
      }

      case 'proveedores_rentabilidad': {
        if (!puede(perfil.rol, 'reportes.ver')) return responder(p, negar('reportes.ver').texto);
        const prods = await ventasPorProducto(sb, perfil.empresa_id);
        const { data: compras } = await sb.from('compras')
          .select('proveedor_id, total').eq('empresa_id', perfil.empresa_id).neq('estado', 'anulada');
        const { data: proveedores } = await sb.from('proveedores')
          .select('id, nombre').eq('empresa_id', perfil.empresa_id);
        const nombres = {};
        for (const pr of proveedores || []) nombres[pr.id] = pr.nombre;
        const mapa = {};
        const fila = (id) => {
          const k = id || 'sin';
          if (!mapa[k]) mapa[k] = { proveedor: nombres[id] || 'Sin proveedor', invertido: 0, ventas: 0, costo: 0, unidades: 0 };
          return mapa[k];
        };
        for (const c of compras || []) fila(c.proveedor_id).invertido += Number(c.total) || 0;
        for (const x of prods) {
          const f = fila(x.proveedor_id);
          f.ventas += x.ingresos;
          f.costo += x.costo;
          f.unidades += x.unidades;
        }
        const filas = Object.values(mapa).map((x) => {
          const ganancia = x.ventas - x.costo;
          return {
            ...x,
            ganancia,
            retorno: x.invertido > 0 ? (ganancia / x.invertido) * 100 : 0,
            margen: x.ventas > 0 ? (ganancia / x.ventas) * 100 : 0,
          };
        }).sort((a, b) => b.ganancia - a.ganancia).map((x) => ({
          proveedor: x.proveedor,
          invertido: moneda(x.invertido),
          ventas: moneda(x.ventas),
          ganancia: moneda(x.ganancia),
          retorno: x.invertido > 0 ? x.retorno.toFixed(1) + '%' : '-',
          margen: x.ventas > 0 ? x.margen.toFixed(1) + '%' : '-',
        }));
        return responder(p, 'Rentabilidad por proveedor (ventas atribuidas a sus productos):',
          tabla('Rentabilidad por proveedor', filas,
            ['proveedor', 'invertido', 'ventas', 'ganancia', 'retorno', 'margen'],
            ['Proveedor', 'Invertido', 'Ventas', 'Ganancia', 'Retorno s/inv.', 'Margen %']));
      }

      case 'rentabilidad_productos': {
        if (!puede(perfil.rol, 'reportes.ver')) return responder(p, negar('reportes.ver').texto);
        const datos = await ventasPorProducto(sb, perfil.empresa_id);
        if (!datos.length) return responder(p, 'Aun no hay ventas confirmadas para calcular la rentabilidad.');
        const peor = /menos|peor|bajo/.test(p.textoPlano);
        const orden = datos.slice()
          .sort((a, b) => (peor ? a.margen - b.margen : b.margen - a.margen))
          .slice(0, 20);
        const filas = orden.map((x) => ({
          producto: x.nombre,
          unidades: x.unidades,
          ingresos: moneda(x.ingresos),
          costo: moneda(x.costo),
          ganancia: moneda(x.ganancia),
          margen: x.margen.toFixed(1) + '%',
        }));
        return responder(p, peor
          ? 'Productos con menor margen (revisa precios o costos):'
          : 'Productos con mayor margen:',
          tabla('Rentabilidad por producto', filas,
            ['producto', 'unidades', 'ingresos', 'costo', 'ganancia', 'margen'],
            ['Producto', 'Unidades', 'Ingresos', 'Costo', 'Ganancia', 'Margen %']));
      }

      case 'rendimiento_almacen': {
        if (!puede(perfil.rol, 'ventas.ver')) return responder(p, negar('ventas.ver').texto);
        const ventasAlm = await ventasPorAlmacen(sb, perfil.empresa_id);
        const { data: almacenes } = await sb.from('almacenes')
          .select('id, nombre').eq('empresa_id', perfil.empresa_id);
        const { data: stock } = await sb.from('producto_almacen')
          .select('almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const nombres = {};
        for (const a of almacenes || []) nombres[a.id] = a.nombre;
        const stockMap = {};
        for (const s of stock || []) stockMap[s.almacen_id] = (stockMap[s.almacen_id] || 0) + (Number(s.cantidad) || 0);
        const mapa = {};
        for (const v of ventasAlm) {
          const k = v.almacen_id || 'sin';
          mapa[k] = { almacen_id: k, unidades: v.unidades, ingresos: v.ingresos };
        }
        for (const a of almacenes || []) {
          if (!mapa[a.id]) mapa[a.id] = { almacen_id: a.id, unidades: 0, ingresos: 0 };
        }
        const filas = Object.values(mapa)
          .sort((a, b) => b.ingresos - a.ingresos)
          .map((x) => ({
            almacen: nombres[x.almacen_id] || 'Sin almacen',
            unidades: x.unidades,
            ingresos: moneda(x.ingresos),
            stock: Math.round((stockMap[x.almacen_id] || 0) * 100) / 100,
          }));
        return responder(p, 'Rendimiento por almacen (ventas y stock actual):',
          tabla('Rendimiento por almacen', filas,
            ['almacen', 'unidades', 'ingresos', 'stock'],
            ['Almacen', 'Unidades vendidas', 'Ingresos', 'Stock actual']));
      }

      case 'modificar_minmax': {
        if (!puede(perfil.rol, 'productos.editar')) return responder(p, negar('productos.editar').texto);
        const r = await buscarProducto(sb, perfil.empresa_id, p.textoPlano, perfil.id);
        if (!r.encontrado) return responder(p, 'No encontre ese producto. Escribe su nombre o codigo.');
        const prod = r.producto;
        const nums = numerosDe(p.textoPlano);
        const mencionaMin = /minimo|\bmin\b/.test(p.textoPlano);
        const mencionaMax = /maximo|\bmax\b/.test(p.textoPlano);
        if (!nums.length) {
          return responder(p, `Dime el nuevo valor para ${prod.nombre}. Por ejemplo: "pon el minimo en 10 y el maximo en 50".`);
        }
        let minimo = Number(prod.stock_minimo) || 0;
        let maximo = Number(prod.stock_maximo) || 0;
        if (mencionaMin && mencionaMax) {
          if (nums.length < 2) return responder(p, `Necesito dos numeros para ${prod.nombre}: minimo y maximo.`);
          minimo = nums[0];
          maximo = nums[1];
        } else if (mencionaMin) {
          minimo = nums[0];
        } else if (mencionaMax) {
          maximo = nums[0];
        } else {
          return responder(p, `Dime si ${nums[0]} es el minimo o el maximo de ${prod.nombre}.`);
        }
        if (maximo > 0 && minimo > maximo) {
          return responder(p, `El minimo (${minimo}) no puede ser mayor que el maximo (${maximo}).`);
        }
        return responder(p,
          `Vas a cambiar los limites de ${prod.nombre} (actual: minimo ${prod.stock_minimo || 0}, maximo ${prod.stock_maximo || 0}) a minimo ${minimo} y maximo ${maximo}. ¿Confirmas?`,
          [{ id: 'confirmar_minmax', etiqueta: 'Confirmar cambio', tipo: 'confirmar_minmax', productoId: prod.id, productoNombre: prod.nombre, stock_minimo: minimo, stock_maximo: maximo }]);
      }

      case 'notificar': {
        const areas = ['Administracion', 'Almacen', 'Farmacia / Despacho', 'Compras', 'Ventas', 'Contabilidad'];
        const plano = p.textoPlano;
        const area = areas.find((a) => plano.includes(clave(a))) || null;
        let mensaje = p.texto
          .replace(/^.*?\b(que|sobre|por)\b\s*/i, '')
          .replace(/^.*?\b(al|a la|a el|a los|a las)\s+(almacen|administracion|compras|ventas|contabilidad|equipo|todos)\s*/i, '')
          .trim();
        if (!mensaje || mensaje.length < 3) mensaje = p.texto.trim();
        return responder(p,
          `Vas a enviar este aviso${area ? ' al area ' + area : ' a toda la empresa'}: "${mensaje}". ¿Confirmas?`,
          [{ id: 'confirmar_notificacion', etiqueta: 'Enviar aviso', tipo: 'confirmar_notificacion', titulo: 'Aviso del asistente', mensaje, destino_area: area }]);
      }

      case 'registrar_traslado': {
        if (!puede(perfil.rol, 'productos.editar')) return responder(p, negar('productos.editar').texto);
        const r = await buscarProducto(sb, perfil.empresa_id, p.textoPlano, perfil.id);
        return responder(p,
          r.encontrado
            ? `Abrire el formulario de traslado con ${r.producto.nombre}. Elige el almacen de origen, el destino y confirma el movimiento.`
            : 'Abrire el formulario de traslado. Elige el producto, los almacenes de origen y destino, y confirma el movimiento.',
          [{ id: 'abrir_traslado', etiqueta: 'Abrir traslado', tipo: 'abrir_traslado', productoId: r.encontrado ? r.producto.id : null }]);
      }

      case 'traslados_recientes': {
        if (!puede(perfil.rol, 'movimientos.ver')) return responder(p, negar('movimientos.ver').texto);
        const { data } = await sb.from('traslados')
          .select('cantidad, fecha, productos(nombre), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
          .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(10);
        const filas = (data || []).map((t) => ({
          fecha: formatoFecha(t.fecha),
          producto: t.productos ? t.productos.nombre : '-',
          origen: t.ao ? t.ao.nombre : '-',
          destino: t.ad ? t.ad.nombre : '-',
          cantidad: t.cantidad,
        }));
        return responder(p, (data && data.length) ? `Ultimos ${data.length} traslados:` : 'Aun no hay traslados registrados.',
          tabla('Traslados', filas, ['fecha', 'producto', 'origen', 'destino', 'cantidad'], ['Fecha', 'Producto', 'Origen', 'Destino', 'Cant']));
      }

      case 'stock_por_almacen': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
        const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id).eq('activo', true).limit(20);
        const porProd = {};
        for (const s of stock || []) {
          if (!porProd[s.producto_id]) porProd[s.producto_id] = {};
          porProd[s.producto_id][s.almacen_id] = s.cantidad;
        }
        const filas = (productos || []).map((prod) => {
          const row = { codigo: prod.codigo, nombre: prod.nombre, total: prod.stock_actual };
          for (const a of almacenes || []) row[a.nombre] = (porProd[prod.id] && porProd[prod.id][a.id]) || 0;
          return row;
        });
        const campos = ['codigo', 'nombre', 'total', ...(almacenes || []).map((a) => a.nombre)];
        const encabezados = ['Codigo', 'Producto', 'Total', ...(almacenes || []).map((a) => a.nombre)];
        return responder(p, (productos && productos.length) ? 'Stock por almacen:' : 'No hay productos.',
          tabla('Stock por almacen', filas, campos, encabezados));
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

      case 'resumen_general': {
        if (!puede(perfil.rol, 'productos.ver')) return responder(p, negar('productos.ver').texto);
        const { data: prods } = await sb.from('productos')
          .select('id, stock_actual, stock_minimo, precio_venta')
          .eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const activos = prods || [];
        const bajos = activos.filter((x) => Number(x.stock_actual) <= Number(x.stock_minimo));
        const agotados = activos.filter((x) => Number(x.stock_actual) <= 0);
        const valor = activos.reduce((a, x) => a + (Number(x.stock_actual) || 0) * (Number(x.precio_venta) || 0), 0);
        const { data: ventasR } = await sb.from('ventas')
          .select('total').eq('empresa_id', perfil.empresa_id).eq('estado', 'confirmada');
        const totalVentas = (ventasR || []).reduce((a, v) => a + (Number(v.total) || 0), 0);
        const { data: cxcR } = await sb.from('cuentas_por_cobrar')
          .select('saldo').eq('empresa_id', perfil.empresa_id).in('estado', ['pendiente', 'parcial']);
        const totalCxc = (cxcR || []).reduce((a, c) => a + (Number(c.saldo) || 0), 0);
        const { data: cxpR } = await sb.from('cuentas_por_pagar')
          .select('saldo').eq('empresa_id', perfil.empresa_id).in('estado', ['pendiente', 'parcial']);
        const totalCxp = (cxpR || []).reduce((a, c) => a + (Number(c.saldo) || 0), 0);
        const filas = [
          { indicador: 'Productos activos', valor: activos.length },
          { indicador: 'Por reponer', valor: bajos.length },
          { indicador: 'Agotados', valor: agotados.length },
          { indicador: 'Valor del inventario', valor: moneda(valor) },
          { indicador: 'Ventas confirmadas', valor: moneda(totalVentas) },
          { indicador: 'Por cobrar', valor: moneda(totalCxc) },
          { indicador: 'Por pagar', valor: moneda(totalCxp) },
        ];
        return responder(p, 'Este es el panorama general de tu negocio:',
          tabla('Resumen general', filas, ['indicador', 'valor'], ['Indicador', 'Valor']));
      }

      case 'recomendaciones': {
        if (!puede(perfil.rol, 'productos.ver') || !puede(perfil.rol, 'ventas.ver')) {
          return responder(p, 'Necesitas permisos de productos y ventas para ver recomendaciones.');
        }
        const { data: prods } = await sb.from('productos')
          .select('id, codigo, nombre, stock_actual, stock_minimo, created_at')
          .eq('empresa_id', perfil.empresa_id).eq('activo', true);
        const activos = prods || [];
        const bajos = activos.filter((x) => Number(x.stock_actual) <= Number(x.stock_minimo));
        const agotados = activos.filter((x) => Number(x.stock_actual) <= 0);
        const { data: movs } = await sb.from('movimientos')
          .select('producto_id, fecha').eq('empresa_id', perfil.empresa_id);
        const ultimo = {};
        const conteo = {};
        for (const m of movs || []) {
          conteo[m.producto_id] = (conteo[m.producto_id] || 0) + 1;
          if (!ultimo[m.producto_id] || new Date(m.fecha) > new Date(ultimo[m.producto_id])) {
            ultimo[m.producto_id] = m.fecha;
          }
        }
        const hoyMs = Date.now();
        const estancados = activos.filter((x) => Number(x.stock_actual) > 0).map((x) => {
          const ult = ultimo[x.id] || x.created_at;
          return { ...x, dias: Math.max(0, Math.floor((hoyMs - new Date(ult).getTime()) / 86400000)), movs: conteo[x.id] || 0 };
        }).filter((x) => x.movs <= 3 || x.dias >= 30).sort((a, b) => b.dias - a.dias);
        const vendidos = (await ventasPorProducto(sb, perfil.empresa_id)).sort((a, b) => b.ingresos - a.ingresos).slice(0, 5);
        const hoy = new Date().toISOString().slice(0, 10);
        const { data: cxc } = await sb.from('cuentas_por_cobrar')
          .select('saldo, fecha_vencimiento').eq('empresa_id', perfil.empresa_id).in('estado', ['pendiente', 'parcial']);
        const vencidas = (cxc || []).filter((c) => c.fecha_vencimiento && c.fecha_vencimiento < hoy);
        const totalVencido = vencidas.reduce((a, c) => a + (Number(c.saldo) || 0), 0);

        const recs = [];
        if (agotados.length) {
          recs.push({ prioridad: 'Alta', accion: 'Reponer agotados', detalle: `${agotados.length} productos sin stock (${agotados.slice(0, 3).map((x) => x.nombre).join(', ')})` });
        }
        if (bajos.length) {
          recs.push({ prioridad: 'Alta', accion: 'Reponer stock bajo', detalle: `${bajos.length} productos en o bajo el minimo` });
        }
        if (vencidas.length) {
          recs.push({ prioridad: 'Alta', accion: 'Cobrar cartera vencida', detalle: `${vencidas.length} cuentas por ${moneda(totalVencido)}` });
        }
        if (estancados.length) {
          recs.push({ prioridad: 'Media', accion: 'Liquidar productos estancados', detalle: `${estancados.length} productos con pocos movimientos (${estancados.slice(0, 3).map((x) => x.nombre).join(', ')})` });
        }
        if (vendidos.length) {
          recs.push({ prioridad: 'Media', accion: 'Asegurar stock de los mas vendidos', detalle: vendidos.slice(0, 3).map((x) => x.nombre).join(', ') });
        }
        if (!recs.length) {
          recs.push({ prioridad: 'Baja', accion: 'Todo en orden', detalle: 'No hay alertas relevantes por ahora' });
        }
        return responder(p, 'Estas son las acciones que te recomiendo priorizar:',
          tabla('Recomendaciones', recs, ['prioridad', 'accion', 'detalle'], ['Prioridad', 'Accion', 'Detalle']));
      }

      case 'ayuda':
        return responder(p, 'Puedo ayudarte con: stock de un producto, productos por reponer (stock bajo), agotados, valor del inventario, conteo de productos, productos mas vendidos, productos estancados o de baja rotacion, compras y volumen por proveedor, rentabilidad por proveedor y por producto, rendimiento por almacen, movimientos por persona, registrar entradas, salidas o traslados, ventas recientes, cuentas por cobrar, cuentas por pagar, caja del dia, margen de ganancia y envio de avisos a un area. Tambien puedo cambiar el stock minimo y maximo de un producto (te pido confirmacion). Escribe algo como "que productos necesito reponer", "cuales son los mas vendidos", "que proveedor me da mas ganancia" o "pon el minimo de cemento en 10".');

      default: {
        const sugerencias = p.sugerencias || [];
        if (sugerencias.length) {
          return responder(p, 'No estoy seguro de lo que necesitas. ¿Quisiste decir...?',
            sugerencias.map((s) => ({
              id: 'sug-' + s.intencion,
              etiqueta: s.etiqueta,
              tipo: 'consulta_rapida',
              texto: s.texto,
            })));
        }
        return responder(p, 'No entendi eso. Puedes preguntarme de forma natural: "que productos necesito reponer", "que se vende mas", "quien me debe", "como va todo" o "que me recomiendas".',
          [{ id: 'ayuda', etiqueta: 'Ver que puedo hacer', tipo: 'ayuda' }]);
      }
    }
  } catch (err) {
    return responder(p, 'Ocurrio un error al consultar: ' + err.message);
  }
}

export const POST = manejar(consultar);

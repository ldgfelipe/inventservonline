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
        // PostgREST no compara columnas entre si, asi que traemos los que
        // tienen existencia y filtramos en memoria: actual <= minimo.
        const { data } = await sb.from('productos')
          .select('codigo, nombre, stock_actual, stock_minimo')
          .eq('empresa_id', perfil.empresa_id).eq('activo', true)
          .gt('stock_actual', 0);
        const bajos = (data || [])
          .filter((x) => Number(x.stock_actual) <= Number(x.stock_minimo))
          .sort((a, b) => a.stock_actual - b.stock_actual).slice(0, 50);
        return responder(p, bajos.length
          ? `Hay ${bajos.length} producto(s) en o por debajo del minimo:`
          : 'Ningun producto esta por debajo del minimo. Todo en orden.',
          tabla('Stock bajo', bajos, ['codigo', 'nombre', 'stock_actual', 'stock_minimo'], ['Codigo', 'Producto', 'Actual', 'Minimo']));
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
          .select('total').eq('empresa_id', perfil.empresa_id).eq('estado', 'confirmada');
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

      case 'ayuda':
        return responder(p, 'Puedo ayudarte con: stock de un producto, productos con stock bajo, agotados, valor total del inventario, movimientos por persona, registrar entradas o salidas, ventas recientes, cuentas por cobrar, cuentas por pagar, caja del dia, margen de ganancia, traslados entre almacenes y stock por almacen. Escribe algo como "cuanto cemento tengo" o "stock por almacen".');

      default:
        return responder(p, 'No entendi eso. Prueba con "¿cuanto cemento tengo?", "stock bajo" o "registrar entrada de 50 de cemento".',
          [{ id: 'ayuda', etiqueta: 'Ver que puedo hacer', tipo: 'ayuda' }]);
    }
  } catch (err) {
    return responder(p, 'Ocurrio un error al consultar: ' + err.message);
  }
}

export const POST = manejar(consultar);

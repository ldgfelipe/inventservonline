import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { mapaPerfiles } from '@/lib/perfiles';

export const runtime = 'nodejs';

/* GET /api/movimientos?tipo=&busqueda=&producto_id=&limite= */
async function listar(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'movimientos.ver');

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');
  const productoId = searchParams.get('producto_id');
  const busqueda = (searchParams.get('busqueda') || '').trim();
  const limite = Math.min(Number(searchParams.get('limite')) || 300, 2000);

  let consulta = sb
    .from('movimientos')
    .select('*, productos(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(limite);

  if (tipo) consulta = consulta.eq('tipo', tipo);
  if (productoId) consulta = consulta.eq('producto_id', productoId);

  const { data, error: err } = await consulta;
  if (err) return error('Error consultando movimientos: ' + err.message, 500);

  // usuario_id no tiene FK a perfiles, asi que se resuelve aparte.
  const perfiles = await mapaPerfiles(sb, (data || []).map((m) => m.usuario_id));

  let filas = (data || []).map((m) => {
    const p = perfiles[m.usuario_id];
    return {
      ...m,
      producto_nombre: m.productos ? m.productos.nombre : null,
      usuario_nombre: p ? p.nombre : null,
      usuario_area: p ? p.area : null,
      usuario_rol: p ? p.rol : null,
      productos: undefined,
    };
  });

  if (busqueda) {
    const b = busqueda.toLowerCase();
    filas = filas.filter((m) => (m.producto_nombre || '').toLowerCase().includes(b));
  }

  return Response.json({ ok: true, movimientos: filas, total: filas.length });
}

/* POST /api/movimientos  { producto_id, tipo, cantidad, precio_unitario, observacion } */
async function registrar(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error('Cuerpo JSON invalido');
  }

  const esEntrada = cuerpo.tipo !== 'salida';
  exigir(perfil, esEntrada ? 'movimientos.entrada' : 'movimientos.salida');

  const productoId = cuerpo.producto_id;
  const cantidad = Number(cuerpo.cantidad);
  if (!productoId) return error('Falta el producto');
  if (!Number.isFinite(cantidad) || cantidad <= 0) return error('La cantidad debe ser mayor a cero');

  // Transaccion real: actualizar stock + insertar movimiento valorizado.
  // La funcion deriva la empresa y el usuario de la sesion, no de los parametros.
  const args = {
    p_producto: productoId,
    p_tipo: esEntrada ? 'entrada' : 'salida',
    p_cantidad: cantidad,
    p_precio: Number(cuerpo.precio_unitario) || 0,
    p_observacion: cuerpo.observacion || null,
    p_proveedor: cuerpo.proveedor_id || null,
    p_concepto: cuerpo.concepto || null,
    p_documento: cuerpo.documento || null,
    p_almacen: cuerpo.almacen_id || null,
  };

  let { data, error: err } = await sbRpc.rpc('registrar_movimiento', args);

  // Compatibilidad: si la base todavia no tiene la migracion 015 (sin
  // p_almacen) o la 010 (sin concepto/documento), se reintenta sin ellos.
  if (err && /registrar_movimiento|argument|schema cache/i.test(err.message)) {
    const { p_almacen, p_concepto, p_documento, ...basicos } = args;
    ({ data, error: err } = await sbRpc.rpc('registrar_movimiento', basicos));
  }

  if (err) {
    if (/insuficiente/i.test(err.message)) return error(err.message, 409);
    return error('No se pudo registrar: ' + err.message, 500);
  }

  await auditar(sb, perfil, {
    accion: 'movimiento.' + (esEntrada ? 'entrada' : 'salida'),
    entidad: 'producto',
    entidadId: productoId,
    detalle: `${esEntrada ? 'entrada' : 'salida'} de ${cantidad}`,
  });

  return Response.json({
    ok: true,
    stock_actual: data.stock_actual,
    producto: data.nombre,
    total: data.total,
    costo_unitario: data.costo_unitario,
    costo_total: data.costo_total,
    costo_promedio: data.costo_promedio,
    saldo_valor: data.saldo_valor,
  }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(registrar);

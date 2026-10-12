import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/movimientos?tipo=&busqueda=&producto_id=&limite= */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'movimientos.ver');

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');
  const productoId = searchParams.get('producto_id');
  const busqueda = (searchParams.get('busqueda') || '').trim();
  const limite = Math.min(Number(searchParams.get('limite')) || 300, 2000);

  let consulta = sb
    .from('movimientos')
    .select('*, productos(nombre), perfiles(nombre, area, rol)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(limite);

  if (tipo) consulta = consulta.eq('tipo', tipo);
  if (productoId) consulta = consulta.eq('producto_id', productoId);

  const { data, error: err } = await consulta;
  if (err) return error('Error consultando movimientos: ' + err.message, 500);

  let filas = (data || []).map((m) => ({
    ...m,
    producto_nombre: m.productos ? m.productos.nombre : null,
    usuario_nombre: m.perfiles ? m.perfiles.nombre : null,
    usuario_area: m.perfiles ? m.perfiles.area : null,
    usuario_rol: m.perfiles ? m.perfiles.rol : null,
    productos: undefined,
    perfiles: undefined,
  }));

  if (busqueda) {
    const b = busqueda.toLowerCase();
    filas = filas.filter((m) => (m.producto_nombre || '').toLowerCase().includes(b));
  }

  return Response.json({ ok: true, movimientos: filas, total: filas.length });
}

/* POST /api/movimientos  { producto_id, tipo, cantidad, precio_unitario, observacion } */
async function registrar(request) {
  const { perfil, sb } = await sesion(request);
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

  // Transaccion real: actualizar stock + insertar movimiento.
  // Se hace con una funcion de Postgres para que sea atomica.
  const { data, error: err } = await sb.rpc('registrar_movimiento', {
    p_empresa: perfil.empresa_id,
    p_producto: productoId,
    p_usuario: perfil.id,
    p_tipo: esEntrada ? 'entrada' : 'salida',
    p_cantidad: cantidad,
    p_precio: Number(cuerpo.precio_unitario) || 0,
    p_observacion: cuerpo.observacion || null,
    p_proveedor: cuerpo.proveedor_id || null,
  });

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
  }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(registrar);

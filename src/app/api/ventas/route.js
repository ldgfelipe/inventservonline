import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/ventas -> ventas de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'ventas.ver');
  const { searchParams } = new URL(request.url);
  const limite = Math.min(Number(searchParams.get('limite')) || 200, 1000);
  const { data, error: err } = await sb.from('ventas')
    .select('*, clientes(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(limite);
  if (err) {
    if (/ventas|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, ventas: [] });
    return error(err.message, 500);
  }
  const ventas = (data || []).map((v) => ({
    ...v,
    cliente_nombre: v.clientes ? v.clientes.nombre : null,
    clientes: undefined,
  }));
  return Response.json({ ok: true, ventas });
}

/* POST /api/ventas { cliente_id?, items:[{producto_id,cantidad,precio_unitario,descuento}], descuento?, impuesto?, notas?, almacen_id? } */
async function crear(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'ventas.crear');
  await exigirModulo(sb, perfil, 'pos');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const items = Array.isArray(cuerpo.items) ? cuerpo.items : [];
  if (!items.length) return error('La venta debe tener al menos un producto');

  try {
    const { data, error: err } = await sbRpc.rpc('registrar_venta', {
      p_cliente: cuerpo.cliente_id || null,
      p_items: items,
      p_descuento: Number(cuerpo.descuento) || 0,
      p_impuesto: Number(cuerpo.impuesto) || 0,
      p_notas: cuerpo.notas || null,
      p_almacen: cuerpo.almacen_id || null,
    });
    if (err) return error(err.message, 400);
    await auditar(sb, perfil, { accion: 'venta.crear', entidad: 'venta', entidadId: data.venta_id, detalle: `total ${data.total}` });
    return Response.json({ ok: true, ...data }, { status: 201 });
  } catch (e) {
    return error(e.message || 'Error al registrar la venta', 400);
  }
}

export const GET = manejar(listar);
export const POST = manejar(crear);

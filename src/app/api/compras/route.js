import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/compras -> compras a proveedores */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'compras.ver');
  const { searchParams } = new URL(request.url);
  const limite = Math.min(Number(searchParams.get('limite')) || 200, 1000);
  const { data, error: err } = await sb.from('compras')
    .select('*, proveedores(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(limite);
  if (err) {
    if (/compras|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, compras: [] });
    return error(err.message, 500);
  }
  const compras = (data || []).map((c) => ({
    ...c, proveedor_nombre: c.proveedores ? c.proveedores.nombre : null, proveedores: undefined,
  }));
  return Response.json({ ok: true, compras });
}

/* POST /api/compras { proveedor_id?, items:[{producto_id,cantidad,costo_unitario}], impuesto?, notas?, almacen_id? } */
async function crear(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'compras.crear');
  await exigirModulo(sb, perfil, 'compras');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const items = Array.isArray(cuerpo.items) ? cuerpo.items : [];
  if (!items.length) return error('La compra debe tener al menos un producto');

  try {
    const { data, error: err } = await sbRpc.rpc('registrar_compra', {
      p_proveedor: cuerpo.proveedor_id || null,
      p_items: items,
      p_impuesto: Number(cuerpo.impuesto) || 0,
      p_notas: cuerpo.notas || null,
      p_almacen: cuerpo.almacen_id || null,
    });
    if (err) return error(err.message, 400);
    await auditar(sb, perfil, { accion: 'compra.crear', entidad: 'compra', entidadId: data.compra_id, detalle: `total ${data.total}` });
    return Response.json({ ok: true, ...data }, { status: 201 });
  } catch (e) {
    return error(e.message || 'Error al registrar la compra', 400);
  }
}

export const GET = manejar(listar);
export const POST = manejar(crear);

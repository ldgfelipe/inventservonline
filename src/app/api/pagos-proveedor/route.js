import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/pagos-proveedor -> pagos a proveedores */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'cxp.ver');
  const { data, error: err } = await sb.from('pagos_proveedor')
    .select('*, proveedores(nombre), compras(numero)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(200);
  if (err) {
    if (/pagos_proveedor|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, pagos: [] });
    return error(err.message, 500);
  }
  const pagos = (data || []).map((p) => ({
    ...p, proveedor_nombre: p.proveedores ? p.proveedores.nombre : null,
    compra_numero: p.compras ? p.compras.numero : null, proveedores: undefined, compras: undefined,
  }));
  return Response.json({ ok: true, pagos });
}

/* POST /api/pagos-proveedor { proveedor_id, compra_id?, monto, metodo?, referencia? } */
async function crear(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'cxp.pagar');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const monto = Number(cuerpo.monto);
  if (!monto || monto <= 0) return error('El monto debe ser mayor a cero');
  if (!cuerpo.proveedor_id) return error('Falta el proveedor');

  try {
    const { data, error: err } = await sbRpc.rpc('registrar_pago_proveedor', {
      p_proveedor: cuerpo.proveedor_id,
      p_compra: cuerpo.compra_id || null,
      p_monto: monto,
      p_metodo: cuerpo.metodo || 'transferencia',
      p_referencia: cuerpo.referencia || null,
    });
    if (err) return error(err.message, 400);
    await auditar(sb, perfil, { accion: 'pago_proveedor.registrar', entidad: 'pago_proveedor', entidadId: data.pago_id, detalle: `monto ${monto}` });
    return Response.json({ ok: true, ...data }, { status: 201 });
  } catch (e) {
    return error(e.message || 'Error al registrar el pago', 400);
  }
}

export const GET = manejar(listar);
export const POST = manejar(crear);

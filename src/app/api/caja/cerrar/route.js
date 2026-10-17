import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

async function cerrar(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'caja.ver');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  if (!cuerpo.sesion_id) return error('Falta sesion_id');
  try {
    const { data, error: err } = await sbRpc.rpc('cerrar_caja', {
      p_sesion_id: cuerpo.sesion_id,
      p_monto_real: Number(cuerpo.monto_real) || 0,
      p_notas: cuerpo.notas || null,
    });
    if (err) return error(err.message, 400);
    await auditar(sb, perfil, { accion: 'caja.cerrar', entidad: 'caja', entidadId: cuerpo.sesion_id, detalle: `dif ${data.diferencia}` });
    return Response.json({ ok: true, ...data });
  } catch (e) { return error(e.message || 'Error al cerrar caja', 400); }
}

export const POST = manejar(cerrar);

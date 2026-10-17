import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/caja/sesiones -> sesiones de caja de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'caja.ver');
  const { data, error: err } = await sb.from('caja_sesiones')
    .select('*').eq('empresa_id', perfil.empresa_id)
    .order('fecha_apertura', { ascending: false }).limit(50);
  if (err) {
    if (/caja_sesiones|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, sesiones: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, sesiones: data || [] });
}

/* POST /api/caja/sesiones { monto_inicial } -> abrir caja */
async function abrir(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'caja.ver');
  let cuerpo; try { cuerpo = await request.json(); } catch { cuerpo = {}; }
  try {
    const { data, error: err } = await sbRpc.rpc('abrir_caja', { p_monto_inicial: Number(cuerpo.monto_inicial) || 0 });
    if (err) return error(err.message, 400);
    await auditar(sb, perfil, { accion: 'caja.abrir', entidad: 'caja', entidadId: data.sesion_id, detalle: `inicial ${data.monto_inicial}` });
    return Response.json({ ok: true, ...data }, { status: 201 });
  } catch (e) { return error(e.message || 'Error al abrir caja', 400); }
}

export const GET = manejar(listar);
export const POST = manejar(abrir);

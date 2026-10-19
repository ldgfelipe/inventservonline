import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

const DEFAULTS = {
  stock_bajo: true, stock_agotado: true, stock_almacen: true,
  cxc_vencida: true, cxp_vencida: true, caja_diferencia: true,
  umbral_stock_pct: 100, dias_cxc: 0,
};

/* GET /api/alertas/config */
async function leer(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  const { data, error: err } = await sb.from('alertas_config').select('*').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (err) {
    if (/alertas_config|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, config: DEFAULTS });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, config: data || DEFAULTS });
}

/* POST /api/alertas/config { ... } */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const fila = {
    empresa_id: perfil.empresa_id,
    stock_bajo: cuerpo.stock_bajo !== false,
    stock_agotado: cuerpo.stock_agotado !== false,
    stock_almacen: cuerpo.stock_almacen !== false,
    cxc_vencida: cuerpo.cxc_vencida !== false,
    cxp_vencida: cuerpo.cxp_vencida !== false,
    caja_diferencia: cuerpo.caja_diferencia !== false,
    umbral_stock_pct: Math.max(0, Math.min(200, Number(cuerpo.umbral_stock_pct) || 100)),
    dias_cxc: Math.max(0, Number(cuerpo.dias_cxc) || 0),
    updated_at: new Date().toISOString(),
  };

  const { data: existe } = await sb.from('alertas_config').select('id').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (existe) {
    const { error: err } = await sb.from('alertas_config').update(fila).eq('empresa_id', perfil.empresa_id);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  } else {
    const { error: err } = await sb.from('alertas_config').insert(fila);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  }
  return Response.json({ ok: true });
}

export const GET = manejar(leer);
export const POST = manejar(guardar);

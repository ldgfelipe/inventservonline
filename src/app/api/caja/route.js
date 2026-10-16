import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/caja -> resumen del dia (cobros de hoy) */
async function resumen(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'caja.ver');
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error: err } = await sb.from('cobros')
    .select('monto, metodo, fecha').eq('empresa_id', perfil.empresa_id)
    .gte('fecha', hoy + 'T00:00:00').lte('fecha', hoy + 'T23:59:59');
  if (err) {
    if (/cobros|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, total: 0, por_metodo: {}, cobros: [] });
    return error(err.message, 500);
  }
  const porMetodo = {};
  let total = 0;
  for (const c of data || []) { total += Number(c.monto) || 0; porMetodo[c.metodo] = (porMetodo[c.metodo] || 0) + (Number(c.monto) || 0); }
  return Response.json({ ok: true, fecha: hoy, total, por_metodo: porMetodo, cobros: data || [] });
}

export const GET = manejar(resumen);

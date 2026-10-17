import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/* GET /api/reportes/caja?desde=&hasta= -> cobros por metodo y dia */
async function caja(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'reportes.ver');
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  let q = sb.from('cobros')
    .select('monto, metodo, fecha').eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: true }).limit(2000);
  if (desde) q = q.gte('fecha', desde + 'T00:00:00');
  if (hasta) q = q.lte('fecha', hasta + 'T23:59:59');
  const { data, error: err } = await q;
  if (err) {
    if (/cobros|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, total: 0, por_metodo: {}, por_dia: {}, cobros: 0 });
    return error(err.message, 500);
  }
  const porMetodo = {};
  const porDia = {};
  let total = 0;
  for (const c of data || []) {
    const m = Number(c.monto) || 0;
    total += m;
    porMetodo[c.metodo] = round2((porMetodo[c.metodo] || 0) + m);
    const dia = String(c.fecha).slice(0, 10);
    porDia[dia] = round2((porDia[dia] || 0) + m);
  }
  return Response.json({ ok: true, total: round2(total), por_metodo: porMetodo, por_dia: porDia, cobros: (data || []).length });
}

export const GET = manejar(caja);

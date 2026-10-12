import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/dashboard -> metricas agregadas.
   Se calculan con SQL en Postgres, no trayendo todos los productos:
   con muchos datos la diferencia es de segundos a milisegundos. */
async function stats(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');

  const { data, error: err } = await sb.rpc('metricas_dashboard', { p_empresa: perfil.empresa_id });
  if (err) return error('Error calculando metricas: ' + err.message, 500);

  return Response.json({ ok: true, stats: data });
}

export const GET = manejar(stats);

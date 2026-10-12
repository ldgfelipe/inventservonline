import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/eventos/adopcion -> metricas de uso del plan.
   Sirve para detectar abandono: si un cliente deja de usar el sistema,
   se ve aqui antes de que cancele. */
async function adopcion(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  const { data, error: err } = await sb.rpc('metricas_adopcion');
  if (err) return error('Error calculando adopcion: ' + err.message, 500);
  return Response.json({ ok: true, ...data });
}

export const GET = manejar(adopcion);

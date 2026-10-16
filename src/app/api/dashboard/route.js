import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/dashboard -> metricas agregadas.
   Se calculan con SQL en Postgres, no trayendo todos los productos:
   con muchos datos la diferencia es de segundos a milisegundos. */
async function stats(request) {
  const { perfil, sbRpc } = await sesion(request);
  exigir(perfil, 'productos.ver');

  // metricas_dashboard usa empresa_del_usuario() que depende de auth.uid().
  // Con el cliente service_role ese valor es null y todas las cifras salian
  // en cero: la llamada tiene que hacerse con el JWT del usuario.
  const { data, error: err } = await sbRpc.rpc('metricas_dashboard');
  if (err) return error('Error calculando metricas: ' + err.message, 500);

  return Response.json({ ok: true, stats: data });
}

export const GET = manejar(stats);

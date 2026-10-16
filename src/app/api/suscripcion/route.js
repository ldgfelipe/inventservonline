import { sesion, exigir, manejar } from '@/lib/auth';
import { resumen } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/suscripcion -> plan actual, vigencia, consumo y catalogo de
   planes. Lo consume la vista de Configuracion / Suscripcion del renderer. */
async function consultar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  const datos = await resumen(sb, perfil);
  return Response.json({ ok: true, ...datos });
}

export const GET = manejar(consultar);

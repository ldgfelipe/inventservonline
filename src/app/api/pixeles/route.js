import { manejar } from '@/lib/auth';
import { leerConfigSitio } from '@/lib/config-sitio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* GET /api/pixeles -> IDs y codigo de seguimiento configurado por el admin.
   Es publico porque los navegadores deben poder cargar los pixeles. */
async function leer() {
  const config = await leerConfigSitio({ force: true });
  return Response.json({ ok: true, config });
}

export const GET = manejar(leer);

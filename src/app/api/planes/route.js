import { catalogoPlanes } from '@/lib/planes';

export const runtime = 'nodejs';

/* GET /api/planes -> catalogo publico de planes (para el registro y la
   pagina de precios). No requiere sesion: ver PUBLICAS en middleware.js. */
export async function GET() {
  return Response.json({ ok: true, planes: catalogoPlanes() });
}

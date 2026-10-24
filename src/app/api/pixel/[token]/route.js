import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* GIF transparente 1x1 */
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/* GET /api/pixel/[token].gif?e=email&u=pagina
   Pixel de apertura para campanas de correo. Siempre devuelve el GIF
   (aunque el token no exista) para no romper el correo. */
export async function GET(request, contexto) {
  try {
    const params = await contexto.params;
    const token = String(params.token || '').replace(/\.gif$/i, '');
    const url = new URL(request.url);
    const email = url.searchParams.get('e') || null;
    const pagina = url.searchParams.get('u') || null;

    if (token) {
      const sb = admin();
      const { data: camp } = await sb.from('campanas')
        .select('id').eq('email_pixel_token', token).maybeSingle();
      await sb.from('email_eventos').insert({
        campana_id: camp ? camp.id : null,
        token,
        tipo: 'apertura',
        email,
        ip: request.headers.get('x-forwarded-for') || null,
        user_agent: request.headers.get('user-agent') || null,
        url: pagina,
      });
    }
  } catch { /* el pixel nunca debe fallar */ }

  return new Response(GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}

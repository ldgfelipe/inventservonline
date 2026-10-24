import { admin } from '@/lib/supabase';
import { motivoBot } from '@/lib/bots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* GIF transparente 1x1 */
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const VENTANA_MS = 6 * 60 * 60 * 1000; // 6 horas

function hace(ms) {
  return new Date(Date.now() - ms).toISOString();
}

/* GET /api/pixel/[token].gif?e=email&u=pagina
   Pixel de apertura. Detecta validadores/prefetch y, si el mismo
   destinatario ya cayo en el honeypot, marca la apertura como bot. */
export async function GET(request, contexto) {
  try {
    const params = await contexto.params;
    const token = String(params.token || '').replace(/\.gif$/i, '');
    const url = new URL(request.url);
    const email = url.searchParams.get('e') || null;
    const pagina = url.searchParams.get('u') || null;
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const ua = request.headers.get('user-agent') || null;

    if (token) {
      const sb = admin();
      let bot = false;
      let motivo = motivoBot(request);

      // ¿Este destinatario/IP ya activo el honeypot hace poco?
      if (!motivo) {
        try {
          let q = sb.from('email_eventos').select('id')
            .eq('token', token).eq('tipo', 'honeypot')
            .gte('created_at', hace(VENTANA_MS)).limit(1);
          if (email && email.includes('@')) q = q.eq('email', email);
          else if (ip) q = q.eq('ip', ip);
          const { data: hp } = await q;
          if (hp && hp.length) { bot = true; motivo = 'honeypot'; }
        } catch { /* si falta la migracion, se ignora */ }
      }

      if (motivo) bot = true;

      const { data: camp } = await sb.from('campanas')
        .select('id').eq('email_pixel_token', token).maybeSingle();

      try {
        const fila = {
          campana_id: camp ? camp.id : null,
          token,
          tipo: 'apertura',
          email,
          ip,
          user_agent: ua,
          url: pagina,
          bot,
          motivo_bot: motivo || null,
        };
        const { error: e } = await sb.from('email_eventos').insert(fila);
        if (e && /bot|motivo_bot|schema cache/i.test(e.message)) {
          delete fila.bot; delete fila.motivo_bot;
          await sb.from('email_eventos').insert(fila);
        }
      } catch { /* el pixel nunca debe fallar */ }
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

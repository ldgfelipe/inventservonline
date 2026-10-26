import { admin } from '@/lib/supabase';
import { motivoBot } from '@/lib/bots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventser.online')
    .replace(/\/+$/, '');
}

const VENTANA_MS = 6 * 60 * 60 * 1000;

function hace(ms) {
  return new Date(Date.now() - ms).toISOString();
}

function paginaVacia() {
  return new Response('<!doctype html><html><head><meta name="robots" content="noindex,nofollow"></head><body></body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* GET /api/click/[token]?e=email&honeypot=1
   Enlace de seguimiento. Registra el click (salvo bots) y redirige a la
   landing de la campana con los UTM. El enlace honeypot no redirige. */
export async function GET(request, contexto) {
  const base = baseUrl();
  let destino = base + '/';

  try {
    const params = await contexto.params;
    const token = String(params.token || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const url = new URL(request.url);
    const email = url.searchParams.get('e') || null;
    const esHoneypot = url.searchParams.get('honeypot') === '1';
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const ua = request.headers.get('user-agent') || null;

    if (token) {
      const sb = admin();
      let camp = null;
      const { data: porCodigo } = await sb.from('campanas')
        .select('*').eq('codigo', token).maybeSingle();
      camp = porCodigo;
      if (!camp) {
        const { data: porPixel } = await sb.from('campanas')
          .select('*').eq('email_pixel_token', token).maybeSingle();
        camp = porPixel;
      }

      // El honeypot solo lo siguen los validadores/crawlers: no cuenta.
      if (esHoneypot) {
        try {
          await sb.from('email_eventos').insert({
            campana_id: camp ? camp.id : null,
            token,
            tipo: 'honeypot',
            email,
            ip,
            user_agent: ua,
            url: null,
            bot: true,
            motivo_bot: 'honeypot',
          });
          // Marca como bot lo que ya se registro para este destinatario/IP.
          let q = sb.from('email_eventos')
            .update({ bot: true, motivo_bot: 'honeypot' })
            .eq('token', token)
            .neq('tipo', 'honeypot')
            .gte('created_at', hace(VENTANA_MS));
          if (email && email.includes('@')) q = q.eq('email', email);
          else if (ip) q = q.eq('ip', ip);
          await q;
        } catch { /* si falta la migracion, se ignora */ }
        return paginaVacia();
      }

      let motivo = motivoBot(request);
      if (!motivo) {
        try {
          let q = sb.from('email_eventos').select('id')
            .eq('token', token).eq('tipo', 'honeypot')
            .gte('created_at', hace(VENTANA_MS)).limit(1);
          if (email && email.includes('@')) q = q.eq('email', email);
          else if (ip) q = q.eq('ip', ip);
          const { data: hp } = await q;
          if (hp && hp.length) motivo = 'honeypot';
        } catch { /* opcional */ }
      }
      const bot = !!motivo;

      if (camp) {
        let target = String(camp.landing_url || '/').trim();
        if (!/^https?:\/\//i.test(target)) {
          target = base + (target.startsWith('/') ? target : '/' + target);
        }
        const u = new URL(target);
        if (camp.utm_source) u.searchParams.set('utm_source', camp.utm_source);
        if (camp.utm_medium) u.searchParams.set('utm_medium', camp.utm_medium);
        if (camp.utm_campaign) u.searchParams.set('utm_campaign', camp.utm_campaign);
        if (camp.utm_content) u.searchParams.set('utm_content', camp.utm_content);
        if (camp.utm_term) u.searchParams.set('utm_term', camp.utm_term);
        if (camp.codigo) u.searchParams.set('ref', camp.codigo);
        if (bot) u.searchParams.set('bot', '1');
        destino = u.toString();
      }

      try {
        const fila = {
          campana_id: camp ? camp.id : null,
          token,
          tipo: 'click',
          email,
          ip,
          user_agent: ua,
          url: destino,
          bot,
          motivo_bot: motivo || null,
        };
        const { error: e } = await sb.from('email_eventos').insert(fila);
        if (e && /bot|motivo_bot|schema cache/i.test(e.message)) {
          delete fila.bot; delete fila.motivo_bot;
          await sb.from('email_eventos').insert(fila);
        }
      } catch { /* opcional */ }
    }
  } catch { /* el click nunca debe fallar */ }

  return Response.redirect(destino, 302);
}

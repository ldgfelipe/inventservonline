import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventservonline.vercel.app')
    .replace(/\/+$/, '');
}

/* GET /api/click/[token]?e=email
   Enlace de seguimiento para campanas. Registra el click y redirige a la
   landing de la campana con sus parametros UTM. La URL destino SIEMPRE
   sale de la campana (nunca de la peticion) para evitar open redirect. */
export async function GET(request, contexto) {
  const base = baseUrl();
  let destino = base + '/';

  try {
    const params = await contexto.params;
    const token = String(params.token || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const url = new URL(request.url);
    const email = url.searchParams.get('e') || null;

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
        destino = u.toString();

        await sb.from('email_eventos').insert({
          campana_id: camp.id,
          token,
          tipo: 'click',
          email,
          ip: request.headers.get('x-forwarded-for') || null,
          user_agent: request.headers.get('user-agent') || null,
          url: destino,
        });
      }
    }
  } catch { /* el click nunca debe fallar */ }

  return Response.redirect(destino, 302);
}

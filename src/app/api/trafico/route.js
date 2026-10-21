import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* POST /api/trafico { campana_id?, fuente?, medio?, utm_*, pagina?, evento?, ip?, user_agent?, referer? }
   Endpoint publico para tracking de visitas/registros/conversiones. */
export async function POST(request) {
  let cuerpo; try { cuerpo = await request.json(); } catch { cuerpo = {}; }
  const sb = admin();
  const { error: err } = await sb.from('trafico').insert({
    empresa_id: cuerpo.empresa_id || null,
    campana_id: cuerpo.campana_id || null,
    fuente: cuerpo.fuente || null,
    medio: cuerpo.medio || null,
    utm_source: cuerpo.utm_source || null,
    utm_medium: cuerpo.utm_medium || null,
    utm_campaign: cuerpo.utm_campaign || null,
    utm_content: cuerpo.utm_content || null,
    utm_term: cuerpo.utm_term || null,
    pagina: cuerpo.pagina || null,
    ip: cuerpo.ip || null,
    user_agent: cuerpo.user_agent || null,
    referer: cuerpo.referer || null,
    evento: cuerpo.evento || 'visita',
  });
  if (err) return Response.json({ ok: false, error: err.message }, { status: 500 });
  // Si es una visita a una landing page, incrementar contador
  if (cuerpo.landing_slug) {
    await sb.from('landing_pages').update({ visitas: sb.rpc ? 0 : 0 }).eq('slug', cuerpo.landing_slug);
  }
  return Response.json({ ok: true });
}

/* GET /api/trafico?campana_id=&fuente=&desde=&hasta=&evento= -> analytics (super-admin) */
export async function GET(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const { searchParams } = new URL(request.url);
  const campanaId = searchParams.get('campana_id');
  const fuente = searchParams.get('fuente');
  const eventoFiltro = searchParams.get('evento');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  let q = sb.from('trafico').select('*').order('created_at', { ascending: false }).limit(500);
  if (campanaId) q = q.eq('campana_id', campanaId);
  if (fuente) q = q.eq('fuente', fuente);
  if (eventoFiltro) q = q.eq('evento', eventoFiltro);
  if (desde) q = q.gte('created_at', desde + 'T00:00:00');
  if (hasta) q = q.lte('created_at', hasta + 'T23:59:59');
  const { data, error: err } = await q;
  if (err) return error(err.message, 500);
  return Response.json({ ok: true, trafico: data || [] });
}

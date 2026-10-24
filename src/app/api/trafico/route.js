import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* POST /api/trafico { campana_id?, fuente?, medio?, utm_*, pagina?, evento?, visitante_id?, sesion_id? }
   Endpoint publico para tracking de visitas/registros/conversiones. */
export async function POST(request) {
  let cuerpo; try { cuerpo = await request.json(); } catch { cuerpo = {}; }
  const sb = admin();

  // Atribuir la visita a una campana por su utm_campaign (si existe).
  let campanaId = cuerpo.campana_id || null;
  if (!campanaId && cuerpo.utm_campaign) {
    const { data: camp } = await sb.from('campanas')
      .select('id').eq('utm_campaign', String(cuerpo.utm_campaign)).maybeSingle();
    if (camp) campanaId = camp.id;
  }

  const fila = {
    empresa_id: cuerpo.empresa_id || null,
    campana_id: campanaId,
    fuente: cuerpo.fuente || null,
    medio: cuerpo.medio || null,
    utm_source: cuerpo.utm_source || null,
    utm_medium: cuerpo.utm_medium || null,
    utm_campaign: cuerpo.utm_campaign || null,
    utm_content: cuerpo.utm_content || null,
    utm_term: cuerpo.utm_term || null,
    pagina: cuerpo.pagina || null,
    ip: cuerpo.ip || null,
    user_agent: cuerpo.user_agent || (request.headers.get('user-agent') || null),
    referer: cuerpo.referer || null,
    visitante_id: cuerpo.visitante_id || null,
    sesion_id: cuerpo.sesion_id || null,
    bot: cuerpo.bot === true,
    motivo_bot: cuerpo.motivo_bot || null,
    evento: cuerpo.evento || 'visita',
  };

  let { error: err } = await sb.from('trafico').insert(fila);
  // Respaldo si aun no se aplico la migracion 039 (columnas bot).
  if (err && /bot|motivo_bot|schema cache/i.test(err.message)) {
    const sinBot = { ...fila };
    delete sinBot.bot;
    delete sinBot.motivo_bot;
    ({ error: err } = await sb.from('trafico').insert(sinBot));
  }
  if (err) return Response.json({ ok: false, error: err.message }, { status: 500 });
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

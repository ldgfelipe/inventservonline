import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

function dia(fecha) {
  return String(fecha || '').slice(0, 10);
}

/* GET /api/admin/tracking -> metricas de campanas, trafico y pixel */
async function analisis(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sb = admin();
  const [
    { data: campanas },
    { data: trafico },
    { data: emails },
    { data: paginas },
  ] = await Promise.all([
    sb.from('campanas').select('*').order('created_at', { ascending: false }),
    sb.from('trafico').select('*').order('created_at', { ascending: false }).limit(3000),
    sb.from('email_eventos').select('*').order('created_at', { ascending: false }).limit(1000),
    sb.from('paginas').select('slug, titulo, publicado').order('updated_at', { ascending: false }),
  ]);

  const visitas = (trafico || []).filter((t) => t.evento === 'visita' && !t.bot);
  const demos = (trafico || []).filter((t) => t.evento === 'demo' && !t.bot);
  const registros = (trafico || []).filter((t) => t.evento === 'registro');
  const aperturas = (emails || []).filter((e) => e.tipo === 'apertura' && !e.bot);
  const clicks = (emails || []).filter((e) => e.tipo === 'click' && !e.bot);
  const aperturasBot = (emails || []).filter((e) => e.tipo === 'apertura' && e.bot);
  const clicksBot = (emails || []).filter((e) => e.tipo === 'click' && e.bot);
  const honeypots = (emails || []).filter((e) => e.tipo === 'honeypot');

  const unicos = new Set();
  for (const v of visitas) if (v.visitante_id) unicos.add(v.visitante_id);

  const porFuente = {};
  for (const v of visitas) {
    const f = v.fuente || 'directo';
    porFuente[f] = (porFuente[f] || 0) + 1;
  }

  const porDia = {};
  for (const v of visitas) {
    const d = dia(v.created_at);
    if (!d) continue;
    if (!porDia[d]) porDia[d] = { visitas: 0, registros: 0, demos: 0 };
    porDia[d].visitas++;
  }
  for (const r of registros) {
    const d = dia(r.created_at);
    if (!d) continue;
    if (!porDia[d]) porDia[d] = { visitas: 0, registros: 0, demos: 0 };
    porDia[d].registros++;
  }
  for (const d of demos) {
    const k = dia(d.created_at);
    if (!k) continue;
    if (!porDia[k]) porDia[k] = { visitas: 0, registros: 0, demos: 0 };
    porDia[k].demos++;
  }

  // Metricas por campana (por id o por utm_campaign)
  const porCampana = {};
  const clave = (id) => id || '_sin';
  function fila(id) {
    const k = clave(id);
    if (!porCampana[k]) porCampana[k] = { visitas: 0, unicos: new Set(), registros: 0, demos: 0, aperturas: 0, clicks: 0 };
    return porCampana[k];
  }
  const porUtm = {};
  for (const c of campanas || []) if (c.utm_campaign) porUtm[c.utm_campaign] = c.id;

  for (const v of visitas) {
    const id = v.campana_id || porUtm[v.utm_campaign] || '_sin';
    const f = fila(id);
    f.visitas++;
    if (v.visitante_id) f.unicos.add(v.visitante_id);
  }
  for (const r of registros) {
    const id = r.campana_id || porUtm[r.utm_campaign] || '_sin';
    fila(id).registros++;
  }
  for (const d of demos) {
    const id = d.campana_id || porUtm[d.utm_campaign] || '_sin';
    fila(id).demos++;
  }
  for (const a of aperturas) fila(a.campana_id || '_sin').aperturas++;
  for (const c of clicks) fila(c.campana_id || '_sin').clicks++;

  const campanasMetricas = (campanas || []).map((c) => {
    const m = porCampana[c.id] || { visitas: 0, unicos: new Set(), registros: 0, demos: 0, aperturas: 0, clicks: 0 };
    return {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      canal: c.canal,
      estado: c.estado,
      codigo: c.codigo,
      email_pixel_token: c.email_pixel_token,
      utm_campaign: c.utm_campaign,
      landing_url: c.landing_url,
      visitas: m.visitas,
      unicos: m.unicos.size,
      registros: m.registros,
      demos: m.demos,
      aperturas: m.aperturas,
      clicks: m.clicks,
      tasa_registro: m.visitas > 0 ? Math.round((m.registros / m.visitas) * 1000) / 10 : 0,
    };
  });

  const sinCampana = porCampana._sin || { visitas: 0, unicos: new Set(), registros: 0, demos: 0, aperturas: 0, clicks: 0 };

  return Response.json({
    ok: true,
    resumen: {
      visitas: visitas.length,
      visitantes_unicos: unicos.size,
      registros: registros.length,
      demos: demos.length,
      aperturas: aperturas.length,
      clicks: clicks.length,
      aperturas_bot: aperturasBot.length,
      clicks_bot: clicksBot.length,
      honeypots: honeypots.length,
      tasa_registro: visitas.length > 0 ? Math.round((registros.length / visitas.length) * 1000) / 10 : 0,
      sin_campana: {
        visitas: sinCampana.visitas,
        unicos: sinCampana.unicos.size,
        registros: sinCampana.registros,
        demos: sinCampana.demos,
        aperturas: sinCampana.aperturas,
        clicks: sinCampana.clicks,
      },
    },
    campanas: campanasMetricas,
    por_fuente: porFuente,
    por_dia: Object.entries(porDia)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 30)
      .map(([fecha, m]) => ({ fecha, ...m })),
    trafico_reciente: (trafico || []).slice(0, 120),
    emails_recientes: (emails || []).slice(0, 120),
    paginas: paginas || [],
  });
}

export const GET = manejar(analisis);

/* POST /api/admin/tracking { accion: 'reiniciar', campana_id? }
   Borra los eventos de trafico y de correo (de una campana o todos).
   No elimina las campanas ni las conversiones: solo las estadisticas. */
async function reiniciar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  if (cuerpo.accion !== 'reiniciar') return error('Accion invalida');
  const campanaId = cuerpo.campana_id ? String(cuerpo.campana_id) : null;

  const sb = admin();
  let elimTrafico = 0;
  let elimEmail = 0;

  try {
    if (campanaId) {
      const { data: t } = await sb.from('trafico').delete().eq('campana_id', campanaId).select('id');
      const { data: e } = await sb.from('email_eventos').delete().eq('campana_id', campanaId).select('id');
      elimTrafico = (t || []).length;
      elimEmail = (e || []).length;
    } else {
      const { data: t } = await sb.from('trafico').delete().gte('created_at', '1970-01-01').select('id');
      const { data: e } = await sb.from('email_eventos').delete().gte('created_at', '1970-01-01').select('id');
      elimTrafico = (t || []).length;
      elimEmail = (e || []).length;
    }
  } catch (err) {
    return error('No se pudieron reiniciar las estadisticas: ' + err.message, 500);
  }

  return Response.json({ ok: true, eliminados_trafico: elimTrafico, eliminados_email: elimEmail });
}

export const POST = manejar(reiniciar);

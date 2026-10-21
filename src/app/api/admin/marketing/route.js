import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/admin/marketing -> analytics completo para super-admin */
async function analisis(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sbAdmin = admin();

  // Freemium users with usage metrics
  const { data: empresas } = await sbAdmin.from('empresas').select('id, nombre, email, giro_actual, plan, created_at').order('created_at', { ascending: false }).limit(200);
  const { data: suscripciones } = await sbAdmin.from('suscripciones_empresas').select('*');
  const susMap = {};
  for (const s of suscripciones || []) susMap[s.empresa_id] = s;

  const freemiumUsers = [];
  for (const e of empresas || []) {
    const sus = susMap[e.id];
    // Contar productos y usuarios
    const { count: productos } = await sbAdmin.from('productos').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id).eq('activo', true);
    const { count: usuarios } = await sbAdmin.from('perfiles').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id);
    const { count: movimientos } = await sbAdmin.from('movimientos').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id);
    const { count: ventas } = await sbAdmin.from('ventas').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id);

    // Score de conversion (0-100)
    let score = 0;
    const factores = {};
    if (productos > 10) { score += 15; factores.productos = 15; }
    if (productos > 50) { score += 10; factores.productos_alto = 10; }
    if (usuarios > 1) { score += 15; factores.multi_usuario = 15; }
    if (movimientos > 20) { score += 20; factores.movimientos = 20; }
    if (movimientos > 100) { score += 10; factores.movimientos_alto = 10; }
    if (ventas > 0) { score += 20; factores.ventas = 20; }
    if (ventas > 10) { score += 10; factores.ventas_alto = 10; }
    // Dias desde registro
    const diasRegistro = Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86400000);
    if (diasRegistro > 7) { score += 5; factores.antiguedad = 5; }
    if (diasRegistro > 30) { score += 5; factores.antiguedad_alta = 5; }
    score = Math.min(100, score);

    freemiumUsers.push({
      id: e.id,
      nombre: e.nombre,
      email: e.email,
      giro: e.giro_actual,
      plan: e.plan,
      suscripcion: sus ? { plan: sus.plan, estado: sus.estado, trial_ends_at: sus.trial_ends_at, fecha_vencimiento: sus.fecha_vencimiento } : null,
      productos, usuarios, movimientos, ventas,
      dias_registro: diasRegistro,
      score,
      factores,
    });
  }

  // Traffic by source
  const { data: trafico } = await sbAdmin.from('trafico').select('fuente, evento, created_at').order('created_at', { ascending: false }).limit(1000);
  const porFuente = {};
  const porEvento = {};
  for (const t of trafico || []) {
    const f = t.fuente || 'directo';
    porFuente[f] = (porFuente[f] || 0) + 1;
    porEvento[t.evento] = (porEvento[t.evento] || 0) + 1;
  }

  // Campaigns
  const { data: campanas } = await sbAdmin.from('campanas').select('*').order('created_at', { ascending: false });

  // Conversiones
  const { data: conversiones } = await sbAdmin.from('conversiones').select('*').order('created_at', { ascending: false }).limit(200);

  // Landing pages
  const { data: landings } = await sbAdmin.from('landing_pages').select('id, nombre, slug, visitas, conversiones, publicada').order('visitas', { ascending: false });

  // Pixeles
  const { data: pixeles } = await sbAdmin.from('pixeles').select('*').order('created_at', { ascending: false });

  // Conversion scores summary
  const scores = freemiumUsers.map((u) => u.score);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highProb = freemiumUsers.filter((u) => u.score >= 60).length;

  return Response.json({
    ok: true,
    freemium_users: freemiumUsers,
    traffic: { por_fuente: porFuente, por_evento: porEvento, total: (trafico || []).length },
    campanas: campanas || [],
    conversiones: conversiones || [],
    landings: landings || [],
    pixeles: pixeles || [],
    resumen: {
      total_empresas: (empresas || []).length,
      freemium: freemiumUsers.filter((u) => u.plan === 'free' || (u.suscripcion && u.suscripcion.estado === 'trial')).length,
      pagadas: freemiumUsers.filter((u) => u.suscripcion && u.suscripcion.estado === 'activo' && u.plan !== 'free').length,
      score_promedio: avgScore,
      alta_probabilidad: highProb,
    },
  });
}

export const GET = manejar(analisis);

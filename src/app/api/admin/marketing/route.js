import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* Cuenta filas por empresa en bloque (evita N+1). */
async function contarPorEmpresa(sb, tabla, extra = {}) {
  let q = sb.from(tabla).select('empresa_id');
  for (const [k, v] of Object.entries(extra)) q = q.eq(k, v);
  const { data } = await q;
  const mapa = {};
  for (const r of data || []) {
    if (!r.empresa_id) continue;
    mapa[r.empresa_id] = (mapa[r.empresa_id] || 0) + 1;
  }
  return mapa;
}

/* GET /api/admin/marketing -> analytics de freemium para super-admin */
async function analisis(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sbAdmin = admin();

  const [
    { data: empresas },
    { data: suscripciones },
    productos,
    usuarios,
    movimientos,
    ventas,
  ] = await Promise.all([
    sbAdmin.from('empresas').select('id, nombre, email, giro_actual, plan, created_at').order('created_at', { ascending: false }).limit(200),
    sbAdmin.from('suscripciones_empresas').select('*'),
    contarPorEmpresa(sbAdmin, 'productos', { activo: true }),
    contarPorEmpresa(sbAdmin, 'perfiles'),
    contarPorEmpresa(sbAdmin, 'movimientos'),
    contarPorEmpresa(sbAdmin, 'ventas'),
  ]);

  const susMap = {};
  for (const s of suscripciones || []) susMap[s.empresa_id] = s;

  const freemiumUsers = (empresas || []).map((e) => {
    const sus = susMap[e.id];
    const nProductos = productos[e.id] || 0;
    const nUsuarios = usuarios[e.id] || 0;
    const nMovimientos = movimientos[e.id] || 0;
    const nVentas = ventas[e.id] || 0;

    let score = 0;
    const factores = {};
    if (nProductos > 10) { score += 15; factores.productos = 15; }
    if (nProductos > 50) { score += 10; factores.productos_alto = 10; }
    if (nUsuarios > 1) { score += 15; factores.multi_usuario = 15; }
    if (nMovimientos > 20) { score += 20; factores.movimientos = 20; }
    if (nMovimientos > 100) { score += 10; factores.movimientos_alto = 10; }
    if (nVentas > 0) { score += 20; factores.ventas = 20; }
    if (nVentas > 10) { score += 10; factores.ventas_alto = 10; }
    const dias = Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86400000);
    if (dias > 7) { score += 5; factores.antiguedad = 5; }
    if (dias > 30) { score += 5; factores.antiguedad_alta = 5; }
    score = Math.min(100, score);

    return {
      id: e.id, nombre: e.nombre, email: e.email, giro: e.giro_actual, plan: e.plan,
      suscripcion: sus ? { plan: sus.plan, estado: sus.estado, trial_ends_at: sus.trial_ends_at, fecha_vencimiento: sus.fecha_vencimiento } : null,
      productos: nProductos, usuarios: nUsuarios, movimientos: nMovimientos, ventas: nVentas,
      dias_registro: dias, score, factores,
    };
  });

  const scores = freemiumUsers.map((u) => u.score);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highProb = freemiumUsers.filter((u) => u.score >= 60).length;

  return Response.json({
    ok: true,
    freemium_users: freemiumUsers,
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

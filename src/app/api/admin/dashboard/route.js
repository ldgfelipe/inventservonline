import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';
import { usoStorageTotal } from '@/lib/storage';

export const runtime = 'nodejs';

/* GET /api/admin/dashboard -> metricas generales del SaaS */
async function metricas(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sbAdmin = admin();

  // Empresas
  const { data: empresas } = await sbAdmin.from('empresas').select('id, nombre, email, giro_actual, plan, pais, moneda, created_at');
  const totalEmpresas = (empresas || []).length;

  // Suscripciones
  const { data: suscripciones } = await sbAdmin.from('suscripciones_empresas').select('*');
  const susMap = {};
  for (const s of suscripciones || []) susMap[s.empresa_id] = s;

  // Contar por plan y estado
  const porPlan = { free: 0, basic: 0, pro: 0, empresa: 0 };
  const porEstado = { activo: 0, trial: 0, vencido: 0, en_revision: 0 };
  let mrr = 0;
  const precios = { free: 0, basic: 9, pro: 19, empresa: 49 };

  for (const e of empresas || []) {
    const sus = susMap[e.id];
    const plan = sus ? sus.plan : (e.plan || 'free');
    const estado = sus ? sus.estado : 'trial';
    if (porPlan[plan] !== undefined) porPlan[plan]++;
    if (porEstado[estado] !== undefined) porEstado[estado]++;
    // MRR: solo planes pagos activos
    if (estado === 'activo' && plan !== 'free') {
      mrr += precios[plan] || 0;
    }
  }

  // Usuarios totales
  const { count: totalUsuarios } = await sbAdmin.from('perfiles').select('id', { count: 'exact', head: true });

  // Productos totales
  const { count: totalProductos } = await sbAdmin.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true);

  // Ventas totales
  const { count: totalVentas } = await sbAdmin.from('ventas').select('id', { count: 'exact', head: true });

  // Pagos pendientes
  const { count: pagosPendientes } = await sbAdmin.from('pagos_saas_historial').select('id', { count: 'exact', head: true }).eq('estado', 'en_revision');

  // Conversiones
  const { data: conversiones } = await sbAdmin.from('conversiones').select('tipo, valor').order('created_at', { ascending: false }).limit(500);
  const convPorTipo = {};
  let totalConversionValor = 0;
  for (const c of conversiones || []) {
    convPorTipo[c.tipo] = (convPorTipo[c.tipo] || 0) + 1;
    totalConversionValor += Number(c.valor) || 0;
  }

  // Trafico
  const { count: totalVisitas } = await sbAdmin.from('trafico').select('id', { count: 'exact', head: true });
  const { count: totalRegistros } = await sbAdmin.from('trafico').select('id', { count: 'exact', head: true }).eq('evento', 'registro');

  // Empresas por mes (ultimos 6 meses)
  const empresasPorMes = {};
  for (const e of empresas || []) {
    const mes = String(e.created_at).slice(0, 7);
    empresasPorMes[mes] = (empresasPorMes[mes] || 0) + 1;
  }

  // Tasa de conversion freemium -> pago
  const freemiumCount = porPlan.free + porEstado.trial;
  const pagadasCount = porPlan.basic + porPlan.pro + porPlan.empresa;
  const tasaConversion = freemiumCount > 0 ? Math.round((pagadasCount / (freemiumCount + pagadasCount)) * 100) : 0;

  // Uso total de storage de la plataforma (best-effort)
  let storageTotalBytes = 0;
  try { storageTotalBytes = await usoStorageTotal(); } catch { storageTotalBytes = 0; }

  return Response.json({
    ok: true,
    metricas: {
      total_empresas: totalEmpresas,
      por_plan: porPlan,
      por_estado: porEstado,
      mrr,
      arr: mrr * 12,
      total_usuarios: totalUsuarios || 0,
      total_productos: totalProductos || 0,
      total_ventas: totalVentas || 0,
      pagos_pendientes: pagosPendientes || 0,
      conversiones: convPorTipo,
      total_conversion_valor: totalConversionValor,
      trafico: { visitas: totalVisitas || 0, registros: totalRegistros || 0 },
      empresas_por_mes: empresasPorMes,
      tasa_conversion: tasaConversion,
      storage_total_bytes: storageTotalBytes,
      storage_total_mb: Math.round((storageTotalBytes / 1024 / 1024) * 100) / 100,
    },
  });
}

export const GET = manejar(metricas);

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

/* GET /api/admin/empresas -> lista de todas las empresas con plan, estado y uso */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sbAdmin = admin();
  const [{ data: empresas, error: err }, { data: suscripciones }] = await Promise.all([
    sbAdmin.from('empresas').select('id, nombre, email, giro_actual, plan, pais, moneda, created_at').order('created_at', { ascending: false }),
    sbAdmin.from('suscripciones_empresas').select('*'),
  ]);
  if (err) return error(err.message, 500);

  const susMap = {};
  for (const s of suscripciones || []) susMap[s.empresa_id] = s;

  const [productos, usuarios, ventas] = await Promise.all([
    contarPorEmpresa(sbAdmin, 'productos', { activo: true }),
    contarPorEmpresa(sbAdmin, 'perfiles'),
    contarPorEmpresa(sbAdmin, 'ventas'),
  ]);

  const result = (empresas || []).map((e) => {
    const sus = susMap[e.id];
    return {
      id: e.id,
      nombre: e.nombre,
      email: e.email,
      giro: e.giro_actual,
      pais: e.pais,
      moneda: e.moneda,
      plan_legacy: e.plan,
      plan: sus ? sus.plan : (e.plan || 'free'),
      estado: sus ? sus.estado : 'trial',
      trial_ends_at: sus ? sus.trial_ends_at : null,
      fecha_vencimiento: sus ? sus.fecha_vencimiento : null,
      productos: productos[e.id] || 0,
      usuarios: usuarios[e.id] || 0,
      ventas: ventas[e.id] || 0,
      created_at: e.created_at,
    };
  });
  return Response.json({ ok: true, empresas: result });
}

/* POST /api/admin/empresas { id, accion, plan?, dias? } */
async function gestionar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const id = String(cuerpo.id || '').trim();
  if (!id) return error('Falta el id de la empresa');
  const accion = String(cuerpo.accion || '').trim().toLowerCase();

  const sbAdmin = admin();

  if (accion === 'cambiar_plan') {
    const plan = String(cuerpo.plan || '').trim();
    if (!['free', 'basic', 'pro', 'empresa'].includes(plan)) return error('Plan invalido');
    const dias = Number(cuerpo.dias) || 30;
    const vencimiento = new Date(Date.now() + dias * 86400000).toISOString();
    const { error: err } = await sbAdmin.from('suscripciones_empresas').upsert({
      empresa_id: id, plan, estado: 'activo', fecha_vencimiento: vencimiento, trial_ends_at: null, updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });
    if (err) return error('No se pudo cambiar: ' + err.message, 500);
    await sbAdmin.from('empresas').update({ plan }).eq('id', id);
    return Response.json({ ok: true, mensaje: `Plan cambiado a ${plan} hasta ${vencimiento.slice(0, 10)}` });
  }

  if (accion === 'extender_trial') {
    const dias = Number(cuerpo.dias) || 14;
    const vencimiento = new Date(Date.now() + dias * 86400000).toISOString();
    const { data: sus } = await sbAdmin.from('suscripciones_empresas').select('id').eq('empresa_id', id).maybeSingle();
    if (sus) {
      const { error: err } = await sbAdmin.from('suscripciones_empresas').update({
        estado: 'trial', trial_ends_at: vencimiento, updated_at: new Date().toISOString(),
      }).eq('empresa_id', id);
      if (err) return error('No se pudo extender: ' + err.message, 500);
    } else {
      const { error: err } = await sbAdmin.from('suscripciones_empresas').insert({
        empresa_id: id, plan: 'pro', estado: 'trial', trial_ends_at: vencimiento,
      });
      if (err) return error('No se pudo crear la suscripcion: ' + err.message, 500);
    }
    return Response.json({ ok: true, mensaje: `Trial extendido ${dias} dias` });
  }

  if (accion === 'suspender') {
    const { error: err } = await sbAdmin.from('suscripciones_empresas').upsert({
      empresa_id: id, estado: 'vencido', updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });
    if (err) return error('No se pudo suspender: ' + err.message, 500);
    return Response.json({ ok: true, mensaje: 'Empresa suspendida' });
  }

  if (accion === 'reactivar') {
    const { error: err } = await sbAdmin.from('suscripciones_empresas').upsert({
      empresa_id: id, estado: 'activo', updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });
    if (err) return error('No se pudo reactivar: ' + err.message, 500);
    return Response.json({ ok: true, mensaje: 'Empresa reactivada' });
  }

  return error('Accion invalida');
}

export const GET = manejar(listar);
export const POST = manejar(gestionar);

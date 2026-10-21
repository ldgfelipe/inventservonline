import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/admin/empresas -> lista de todas las empresas con plan, estado y uso */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sbAdmin = admin();
  const { data: empresas, error: err } = await sbAdmin.from('empresas').select('id, nombre, email, giro_actual, plan, pais, moneda, created_at').order('created_at', { ascending: false });
  if (err) return error(err.message, 500);

  const { data: suscripciones } = await sbAdmin.from('suscripciones_empresas').select('*');
  const susMap = {};
  for (const s of suscripciones || []) susMap[s.empresa_id] = s;

  const result = [];
  for (const e of empresas || []) {
    const sus = susMap[e.id];
    const { count: productos } = await sbAdmin.from('productos').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id).eq('activo', true);
    const { count: usuarios } = await sbAdmin.from('perfiles').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id);
    const { count: ventas } = await sbAdmin.from('ventas').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id);
    result.push({
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
      productos: productos || 0,
      usuarios: usuarios || 0,
      ventas: ventas || 0,
      created_at: e.created_at,
    });
  }
  return Response.json({ ok: true, empresas: result });
}

/* POST /api/admin/empresas { id, accion, plan?, dias? } -> cambiar plan o extender trial */
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
    const { error: err } = await sbAdmin.from('suscripciones_empresas').update({
      estado: 'trial', trial_ends_at: vencimiento, updated_at: new Date().toISOString(),
    }).eq('empresa_id', id);
    if (err) return error('No se pudo extender: ' + err.message, 500);
    return Response.json({ ok: true, mensaje: `Trial extendido ${dias} dias` });
  }

  if (accion === 'suspender') {
    const { error: err } = await sbAdmin.from('suscripciones_empresas').update({
      estado: 'vencido', updated_at: new Date().toISOString(),
    }).eq('empresa_id', id);
    if (err) return error('No se pudo suspender: ' + err.message, 500);
    return Response.json({ ok: true, mensaje: 'Empresa suspendida' });
  }

  if (accion === 'reactivar') {
    const { error: err } = await sbAdmin.from('suscripciones_empresas').update({
      estado: 'activo', updated_at: new Date().toISOString(),
    }).eq('empresa_id', id);
    if (err) return error('No se pudo reactivar: ' + err.message, 500);
    return Response.json({ ok: true, mensaje: 'Empresa reactivada' });
  }

  return error('Accion invalida');
}

export const GET = manejar(listar);
export const POST = manejar(gestionar);

import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

const TIPOS = ['ccp', 'organico', 'mailing', 'referido', 'otro'];
const ESTADOS = ['borrador', 'activa', 'pausada', 'finalizada'];

function limpiar(cuerpo = {}) {
  const salida = { updated_at: new Date().toISOString() };
  if (cuerpo.nombre !== undefined) {
    const n = String(cuerpo.nombre).trim();
    if (!n) return { __error: 'El nombre es obligatorio' };
    salida.nombre = n;
  }
  if (cuerpo.tipo !== undefined && TIPOS.includes(cuerpo.tipo)) salida.tipo = cuerpo.tipo;
  if (cuerpo.canal !== undefined) salida.canal = String(cuerpo.canal || '').trim() || null;
  if (cuerpo.descripcion !== undefined) salida.descripcion = String(cuerpo.descripcion || '').trim() || null;
  if (cuerpo.presupuesto !== undefined) salida.presupuesto = Number(cuerpo.presupuesto) || 0;
  if (cuerpo.moneda !== undefined) salida.moneda = String(cuerpo.moneda || 'USD').trim().toUpperCase();
  if (cuerpo.fecha_inicio !== undefined) salida.fecha_inicio = cuerpo.fecha_inicio || null;
  if (cuerpo.fecha_fin !== undefined) salida.fecha_fin = cuerpo.fecha_fin || null;
  if (cuerpo.estado !== undefined && ESTADOS.includes(cuerpo.estado)) salida.estado = cuerpo.estado;
  if (cuerpo.utm_source !== undefined) salida.utm_source = String(cuerpo.utm_source || '').trim() || null;
  if (cuerpo.utm_medium !== undefined) salida.utm_medium = String(cuerpo.utm_medium || '').trim() || null;
  if (cuerpo.utm_campaign !== undefined) salida.utm_campaign = String(cuerpo.utm_campaign || '').trim() || null;
  if (cuerpo.utm_content !== undefined) salida.utm_content = String(cuerpo.utm_content || '').trim() || null;
  if (cuerpo.utm_term !== undefined) salida.utm_term = String(cuerpo.utm_term || '').trim() || null;
  if (cuerpo.landing_url !== undefined) salida.landing_url = String(cuerpo.landing_url || '').trim() || null;
  return salida;
}

/* PATCH /api/admin/campanas/[id] */
async function actualizar(request, contexto) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const { id } = await contexto.params;
  const datos = limpiar(cuerpo);
  if (datos.__error) return error(datos.__error);
  delete datos.__error;

  const sb = admin();
  const { data, error: err } = await sb.from('campanas').update(datos).eq('id', id).select('*').single();
  if (err) return error('No se pudo actualizar: ' + err.message, 500);
  return Response.json({ ok: true, campana: data });
}

/* DELETE /api/admin/campanas/[id] */
async function borrar(request, contexto) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const { id } = await contexto.params;
  const sb = admin();
  const { error: err } = await sb.from('campanas').delete().eq('id', id);
  if (err) return error('No se pudo eliminar: ' + err.message, 500);
  return Response.json({ ok: true });
}

export const PATCH = manejar(actualizar);
export const DELETE = manejar(borrar);

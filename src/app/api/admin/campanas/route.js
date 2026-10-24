import crypto from 'node:crypto';
import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

function token(largo = 8) {
  return crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, largo);
}

const TIPOS = ['ccp', 'organico', 'mailing', 'referido', 'otro'];
const ESTADOS = ['borrador', 'activa', 'pausada', 'finalizada'];

function limpiar(cuerpo = {}) {
  const salida = {};
  if (cuerpo.nombre !== undefined) salida.nombre = String(cuerpo.nombre).trim();
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

/* GET /api/admin/campanas */
async function listar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const sb = admin();
  const { data, error: err } = await sb.from('campanas').select('*').order('created_at', { ascending: false });
  if (err) {
    if (/campanas|does not exist|schema cache/i.test(err.message)) {
      return Response.json({ ok: true, campanas: [], aviso: 'Falta aplicar la migracion 030 (campanas).' });
    }
    return error(err.message, 500);
  }
  return Response.json({ ok: true, campanas: data || [] });
}

/* POST /api/admin/campanas */
async function crear(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const datos = limpiar(cuerpo);
  if (!datos.nombre) return error('El nombre de la campana es obligatorio');

  const sb = admin();
  // Codigo y token unicos (reintenta si colisionan)
  let codigo = token(8);
  let pixel = token(24);
  const { data: existentes } = await sb.from('campanas').select('codigo, email_pixel_token');
  const usados = new Set();
  for (const c of existentes || []) {
    if (c.codigo) usados.add(c.codigo);
    if (c.email_pixel_token) usados.add(c.email_pixel_token);
  }
  while (usados.has(codigo)) codigo = token(8);
  while (usados.has(pixel)) pixel = token(24);

  const { data, error: err } = await sb.from('campanas')
    .insert({
      ...datos,
      utm_campaign: datos.utm_campaign || datos.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      codigo,
      email_pixel_token: pixel,
    })
    .select('*').single();
  if (err) return error('No se pudo crear la campana: ' + err.message, 500);
  return Response.json({ ok: true, campana: data }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(crear);

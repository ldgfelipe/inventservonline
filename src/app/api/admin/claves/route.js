import { error, sesion, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/admin/claves -> claves de administrador (solo super admin) */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const { data, error: err } = await sb.from('claves_admin')
    .select('id, codigo, descripcion, usos, max_usos, activa, expira_en, created_at')
    .order('created_at', { ascending: false });
  if (err) return error(err.message, 500);

  return Response.json({ ok: true, claves: data || [] });
}

/* POST /api/admin/claves { descripcion, max_usos, dias } */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { cuerpo = {}; }

  const descripcion = String(cuerpo.descripcion || 'Clave de administrador').trim();
  const maxUsos = Math.max(1, Number(cuerpo.max_usos) || 1);
  const dias = Number(cuerpo.dias);

  // Alfabeto sin caracteres ambiguos, para poder dictarla por telefono
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const azar = (n) => Array.from({ length: n }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('');
  const codigo = `ADM-${azar(4)}-${azar(4)}-${azar(4)}`;

  const fila = { codigo, descripcion, max_usos: maxUsos };
  if (dias > 0) fila.expira_en = new Date(Date.now() + dias * 86400000).toISOString();

  const { data, error: err } = await sb.from('claves_admin').insert(fila).select('*').single();
  if (err) return error('No se pudo crear la clave: ' + err.message, 500);

  // Se devuelve UNA vez: despues solo se ve enmascarada
  return Response.json({ ok: true, clave: data }, { status: 201 });
}

/* PATCH /api/admin/claves { id, activa } -> activar o desactivar */
async function estado(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  if (!cuerpo.id) return error('Falta el id');

  const { error: err } = await sb.from('claves_admin')
    .update({ activa: cuerpo.activa !== false })
    .eq('id', cuerpo.id);
  if (err) return error('No se pudo actualizar: ' + err.message, 500);

  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(crear);
export const PATCH = manejar(estado);

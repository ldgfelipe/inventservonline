import { error, sesion, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/landing -> lista de landing pages */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const { data, error: err } = await sb.from('landing_pages').select('*').order('created_at', { ascending: false });
  if (err) {
    if (/landing_pages|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, landings: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, landings: data || [] });
}

/* POST /api/landing { nombre, slug, titulo, descripcion, contenido, campana_id, pixeles, publicada } */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const nombre = String(cuerpo.nombre || '').trim();
  const slug = String(cuerpo.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!nombre || !slug) return error('Nombre y slug son obligatorios');
  const { data, error: err } = await sb.from('landing_pages').insert({
    nombre, slug,
    titulo: cuerpo.titulo || null,
    descripcion: cuerpo.descripcion || null,
    contenido: cuerpo.contenido || null,
    campana_id: cuerpo.campana_id || null,
    pixeles: Array.isArray(cuerpo.pixeles) ? cuerpo.pixeles : null,
    publicada: cuerpo.publicada === true,
    created_by: perfil.id,
  }).select('id, slug').single();
  if (err) {
    if (err.code === '23505') return error('Ya existe una landing con ese slug', 409);
    return error('No se pudo crear: ' + err.message, 500);
  }
  return Response.json({ ok: true, id: data.id, slug: data.slug }, { status: 201 });
}

/* PATCH /api/landing { id, ... } */
async function actualizar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const id = String(cuerpo.id || '').trim();
  if (!id) return error('Falta el id');
  const cambios = {};
  if (cuerpo.nombre !== undefined) cambios.nombre = cuerpo.nombre;
  if (cuerpo.titulo !== undefined) cambios.titulo = cuerpo.titulo;
  if (cuerpo.descripcion !== undefined) cambios.descripcion = cuerpo.descripcion;
  if (cuerpo.contenido !== undefined) cambios.contenido = cuerpo.contenido;
  if (cuerpo.publicada !== undefined) cambios.publicada = cuerpo.publicada === true;
  if (cuerpo.pixeles !== undefined) cambios.pixeles = cuerpo.pixeles;
  cambios.updated_at = new Date().toISOString();
  const { error: err } = await sb.from('landing_pages').update(cambios).eq('id', id);
  if (err) return error('No se pudo actualizar: ' + err.message, 500);
  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(crear);
export const PATCH = manejar(actualizar);

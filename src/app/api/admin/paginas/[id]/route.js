import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/admin/paginas/[id] */
async function leer(request, contexto) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const { id } = await contexto.params;
  const sb = admin();
  const { data, error: err } = await sb.from('paginas').select('*').eq('id', id).maybeSingle();
  if (err) return error(err.message, 500);
  if (!data) return error('Pagina no encontrada', 404);
  return Response.json({ ok: true, pagina: data });
}

/* PATCH /api/admin/paginas/[id] */
async function actualizar(request, contexto) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const { id } = await contexto.params;
  const sb = admin();

  const cambios = { updated_at: new Date().toISOString() };
  if (cuerpo.titulo !== undefined) {
    const t = String(cuerpo.titulo).trim();
    if (!t) return error('El titulo es obligatorio');
    cambios.titulo = t;
  }
  if (cuerpo.slug !== undefined) {
    const s = String(cuerpo.slug).trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!s) return error('El slug no es valido');
    cambios.slug = s;
  }
  if (cuerpo.tipo !== undefined && ['landing', 'blog'].includes(cuerpo.tipo)) cambios.tipo = cuerpo.tipo;
  if (cuerpo.html !== undefined) cambios.html = String(cuerpo.html);
  if (cuerpo.publicado !== undefined) cambios.publicado = cuerpo.publicado === true;

  const { data, error: err } = await sb.from('paginas')
    .update(cambios).eq('id', id)
    .select('id, slug, titulo, tipo, publicado, created_at, updated_at')
    .single();
  if (err) {
    if (/duplicate|unique/i.test(err.message)) return error('Ya existe una pagina con ese slug', 409);
    return error('No se pudo actualizar: ' + err.message, 500);
  }
  return Response.json({ ok: true, pagina: data });
}

/* DELETE /api/admin/paginas/[id] */
async function borrar(request, contexto) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const { id } = await contexto.params;
  const sb = admin();
  const { error: err } = await sb.from('paginas').delete().eq('id', id);
  if (err) return error('No se pudo eliminar: ' + err.message, 500);
  return Response.json({ ok: true });
}

export const GET = manejar(leer);
export const PATCH = manejar(actualizar);
export const DELETE = manejar(borrar);

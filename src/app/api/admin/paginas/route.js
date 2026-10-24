import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

function slugify(s) {
  return String(s || '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/* GET /api/admin/paginas -> listado */
async function listar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sb = admin();
  const { data, error: err } = await sb.from('paginas')
    .select('id, slug, titulo, tipo, publicado, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (err) {
    if (/paginas|does not exist|schema cache/i.test(err.message)) {
      return Response.json({ ok: true, paginas: [], aviso: 'Falta aplicar la migracion 036 (paginas).' });
    }
    return error(err.message, 500);
  }
  return Response.json({ ok: true, paginas: data || [] });
}

/* POST /api/admin/paginas -> crear */
async function crear(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const titulo = String(cuerpo.titulo || '').trim();
  if (!titulo) return error('El titulo es obligatorio');

  const slug = slugify(cuerpo.slug || titulo);
  if (!slug) return error('El slug no es valido');

  const tipo = ['landing', 'blog'].includes(cuerpo.tipo) ? cuerpo.tipo : 'landing';
  const html = String(cuerpo.html || '');
  const publicado = cuerpo.publicado === true;

  const sb = admin();
  const { data, error: err } = await sb.from('paginas')
    .insert({ slug, titulo, tipo, html, publicado })
    .select('id, slug, titulo, tipo, publicado, created_at, updated_at')
    .single();
  if (err) {
    if (/duplicate|unique/i.test(err.message)) return error('Ya existe una pagina con ese slug', 409);
    return error('No se pudo crear: ' + err.message, 500);
  }
  return Response.json({ ok: true, pagina: data }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(crear);

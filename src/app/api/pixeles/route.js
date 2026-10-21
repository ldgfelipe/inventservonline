import { error, sesion, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/pixeles -> lista de pixeles */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const { data, error: err } = await sb.from('pixeles').select('*').order('created_at', { ascending: false });
  if (err) {
    if (/pixeles|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, pixeles: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, pixeles: data || [] });
}

/* POST /api/pixeles { nombre, plataforma, pixel_id, codigo, activo, global } */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const nombre = String(cuerpo.nombre || '').trim();
  const plataforma = String(cuerpo.plataforma || '').trim();
  const pixelId = String(cuerpo.pixel_id || '').trim();
  if (!nombre || !plataforma || !pixelId) return error('Nombre, plataforma y pixel_id son obligatorios');
  const { data, error: err } = await sb.from('pixeles').insert({
    nombre, plataforma, pixel_id: pixelId,
    codigo: cuerpo.codigo || null,
    activo: cuerpo.activo !== false,
    global: cuerpo.global !== false,
  }).select('id').single();
  if (err) return error('No se pudo crear: ' + err.message, 500);
  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

/* DELETE /api/pixeles?id= */
async function eliminar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error('Falta el id');
  const { error: err } = await sb.from('pixeles').delete().eq('id', id);
  if (err) return error('No se pudo eliminar: ' + err.message, 500);
  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(crear);
export const DELETE = manejar(eliminar);

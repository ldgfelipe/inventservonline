import { error, sesion, manejar } from '@/lib/auth';
import { conJwt } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/giros -> catalogo compartido de giros.
   Tambien es publico: la pagina de registro lo necesita para ofrecer
   el listado antes de que exista ninguna sesion. */
async function listar(request) {
  // Sin sesion (registro) se lee con la clave anonima; el catalogo es publico.
  let sb;
  try {
    const s = await sesion(request);
    sb = s.sb;
  } catch {
    sb = conJwt();
  }

  const { data, error: err } = await sb.from('giros')
    .select('id, nombre, descripcion, activo')
    .eq('activo', true)
    .order('nombre');
  if (err) return error(err.message, 500);

  return Response.json({ ok: true, giros: data || [] });
}

/* PATCH /api/giros { nombre } -> cambia el giro activo de la empresa */
async function cambiar(request) {
  const { perfil, sb } = await sesion(request);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const nombre = String(cuerpo.nombre || '').trim();
  const { data: giro } = await sb.from('giros').select('nombre').eq('nombre', nombre).maybeSingle();
  if (!giro) return error('Giro no valido');

  const { error: err } = await sb.from('empresas')
    .update({ giro_actual: nombre })
    .eq('id', perfil.empresa_id);
  if (err) return error('No se pudo cambiar el giro: ' + err.message, 500);

  return Response.json({ ok: true, giro: nombre });
}

export const GET = manejar(listar);
export const PATCH = manejar(cambiar);

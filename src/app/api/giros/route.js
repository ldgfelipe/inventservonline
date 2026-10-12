import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/giros -> catalogo compartido de giros */
async function listar(request) {
  const { sb } = await sesion(request);
  const { data, error: err } = await sb.from('giros').select('*').order('nombre');
  if (err) return error(err.message, 500);
  return Response.json({ ok: true, giros: data || [] });
}

/* PATCH /api/giros { nombre } -> cambia el giro activo de la empresa */
async function cambiar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const nombre = String(cuerpo.nombre || '').trim();
  const { data: giro } = await sb.from('giros').select('nombre').eq('nombre', nombre).maybeSingle();
  if (!giro) return error('Giro no valido');

  const { error: err } = await sb.from('empresas')
    .update({ giro_actual: nombre })
    .eq('id', perfil.empresa_id);
  if (err) return error('No se pudo cambiar el giro: ' + err.message, 500);

  await auditar(sb, perfil, { accion: 'config.giro', entidad: 'config', detalle: 'Giro -> ' + nombre });
  return Response.json({ ok: true, giro: nombre });
}

export const GET = manejar(listar);
export const PATCH = manejar(cambiar);

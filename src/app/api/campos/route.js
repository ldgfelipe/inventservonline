import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/campos -> agrega un campo personalizado a un giro (solo admin) */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const nombre = String(cuerpo.nombre || '').trim();
  const giroNombre = String(cuerpo.nombreGiro || '').trim();
  if (!nombre) return error('El nombre del campo es obligatorio');
  if (!giroNombre) return error('Falta el giro');

  const { data: giro } = await sb.from('giros').select('id').eq('nombre', giroNombre).maybeSingle();
  if (!giro) return error('Giro no encontrado');

  const { data: existe } = await sb.from('campos_giro')
    .select('id').eq('giro_id', giro.id).eq('nombre', nombre).maybeSingle();
  if (existe) return error('Ese campo ya existe en este giro', 409);

  const { data, error: err } = await sb.from('campos_giro').insert({
    giro_id: giro.id,
    nombre,
    tipo: cuerpo.tipo || 'text',
    obligatorio: !!cuerpo.obligatorio,
  }).select('id').single();

  if (err) return error('No se pudo crear el campo: ' + err.message, 500);
  await auditar(sb, perfil, { accion: 'campo.crear', entidad: 'campo', entidadId: data.id, detalle: nombre });
  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

/* DELETE /api/campos?id= */
async function eliminar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error('Falta el id');

  await sb.from('valores_campos').delete().eq('empresa_id', perfil.empresa_id).eq('campo_id', id);
  const { error: err } = await sb.from('campos_giro').delete().eq('id', id);
  if (err) return error('No se pudo eliminar: ' + err.message, 500);

  await auditar(sb, perfil, { accion: 'campo.eliminar', entidad: 'campo', entidadId: id });
  return Response.json({ ok: true });
}

export const POST = manejar(crear);
export const DELETE = manejar(eliminar);

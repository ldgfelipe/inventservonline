import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/soporte -> tickets de mi empresa (o todos si super-admin) */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  let q = sb.from('soporte_tickets').select('*').order('created_at', { ascending: false }).limit(200);
  if (!perfil.super_admin) q = q.eq('empresa_id', perfil.empresa_id);
  const { data, error: err } = await q;
  if (err) {
    if (/soporte_tickets|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, tickets: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, tickets: data || [] });
}

/* POST /api/soporte { asunto, descripcion, categoria?, prioridad? } */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const asunto = String(cuerpo.asunto || '').trim();
  const descripcion = String(cuerpo.descripcion || '').trim();
  if (!asunto) return error('El asunto es obligatorio');
  if (!descripcion) return error('La descripcion es obligatoria');

  const { data, error: err } = await sb.from('soporte_tickets').insert({
    empresa_id: perfil.empresa_id,
    usuario_id: perfil.id,
    usuario: perfil.nombre,
    asunto,
    descripcion,
    categoria: cuerpo.categoria || 'general',
    prioridad: cuerpo.prioridad || 'media',
    estado: 'abierto',
  }).select('id').single();
  if (err) return error('No se pudo crear el ticket: ' + err.message, 500);
  await auditar(sb, perfil, { accion: 'soporte.crear', entidad: 'ticket', entidadId: data.id, detalle: asunto });
  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

/* PATCH /api/soporte { id, estado?, respuesta? } (super-admin responde) */
async function responder(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const id = String(cuerpo.id || '').trim();
  if (!id) return error('Falta el id');
  const cambios = { updated_at: new Date().toISOString() };
  if (cuerpo.estado) cambios.estado = cuerpo.estado;
  if (cuerpo.respuesta !== undefined) {
    cambios.respuesta = cuerpo.respuesta;
    cambios.respondido_por = perfil.id;
    cambios.respondido_at = new Date().toISOString();
  }
  const { error: err } = await sb.from('soporte_tickets').update(cambios).eq('id', id);
  if (err) return error('No se pudo actualizar: ' + err.message, 500);
  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(crear);
export const PATCH = manejar(responder);

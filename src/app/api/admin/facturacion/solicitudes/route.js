import { error, sesion, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/admin/facturacion/solicitudes -> todas las solicitudes (super-admin) */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const { data, error: err } = await sb.from('facturacion_solicitudes')
    .select('*, empresas(nombre)').order('created_at', { ascending: false }).limit(200);
  if (err) return error(err.message, 500);
  const sols = (data || []).map((s) => ({ ...s, empresa: s.empresas ? s.empresas.nombre : null, empresas: undefined }));
  return Response.json({ ok: true, solicitudes: sols });
}

/* POST /api/admin/facturacion/solicitudes { id, estado, notas_admin } */
async function resolver(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const id = String(cuerpo.id || '').trim();
  if (!id) return error('Falta el id');
  const cambios = {};
  if (cuerpo.estado) cambios.estado = cuerpo.estado;
  if (cuerpo.notas_admin !== undefined) cambios.notas_admin = cuerpo.notas_admin;
  if (cuerpo.estado === 'implementado') cambios.implementado_en = new Date().toISOString();
  cambios.updated_at = new Date().toISOString();
  const { error: err } = await sb.from('facturacion_solicitudes').update(cambios).eq('id', id);
  if (err) return error('No se pudo actualizar: ' + err.message, 500);
  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(resolver);

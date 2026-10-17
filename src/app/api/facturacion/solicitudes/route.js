import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/facturacion/solicitudes -> mis solicitudes (o todas si super-admin) */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  const superAdmin = !!perfil.super_admin;
  let q = sb.from('facturacion_solicitudes').select('*, empresas(nombre)').order('created_at', { ascending: false }).limit(100);
  if (!superAdmin) q = q.eq('empresa_id', perfil.empresa_id);
  const { data, error: err } = await q;
  if (err) {
    if (/facturacion_solicitudes|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, solicitudes: [] });
    return error(err.message, 500);
  }
  const sols = (data || []).map((s) => ({ ...s, empresa: s.empresas ? s.empresas.nombre : null, empresas: undefined }));
  return Response.json({ ok: true, solicitudes: sols });
}

/* POST /api/facturacion/solicitudes { pais, proveedor?, descripcion } */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const pais = String(cuerpo.pais || '').trim().toUpperCase();
  if (!pais) return error('Falta el pais');
  const { data, error: err } = await sb.from('facturacion_solicitudes').insert({
    empresa_id: perfil.empresa_id,
    pais,
    proveedor: cuerpo.proveedor || null,
    descripcion: cuerpo.descripcion || null,
  }).select('id').single();
  if (err) return error('No se pudo crear la solicitud: ' + err.message, 500);
  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(crear);

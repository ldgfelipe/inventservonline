import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/proveedores */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'proveedores.ver');
  const { data, error: err } = await sb.from('proveedores')
    .select('*').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre');
  if (err) return error(err.message, 500);
  return Response.json({ ok: true, proveedores: data || [] });
}

/* POST /api/proveedores */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'proveedores.gestionar');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const nombre = String(cuerpo.nombre || '').trim();
  if (!nombre) return error('El nombre es obligatorio');

  const fila = {
    empresa_id: perfil.empresa_id,
    nombre,
    rif: cuerpo.rif || null,
    telefono: cuerpo.telefono || null,
    email: cuerpo.email || null,
    direccion: cuerpo.direccion || null,
  };

  let id = cuerpo.id;
  if (id) {
    const { error: err } = await sb.from('proveedores').update(fila)
      .eq('empresa_id', perfil.empresa_id).eq('id', id);
    if (err) return error('No se pudo actualizar: ' + err.message, 500);
  } else {
    const { data, error: err } = await sb.from('proveedores').insert(fila).select('id').single();
    if (err) return error('No se pudo crear: ' + err.message, 500);
    id = data.id;
  }

  await auditar(sb, perfil, { accion: 'proveedor.guardar', entidad: 'proveedor', entidadId: id, detalle: nombre });
  return Response.json({ ok: true, id });
}

export const GET = manejar(listar);
export const POST = manejar(guardar);

import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/clientes -> clientes de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'clientes.ver');
  const { searchParams } = new URL(request.url);
  const busqueda = (searchParams.get('busqueda') || '').trim();
  let q = sb.from('clientes').select('*').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre');
  if (busqueda) q = q.ilike('nombre', `%${busqueda}%`);
  const { data, error: err } = await q;
  if (err) {
    if (/clientes|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, clientes: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, clientes: data || [] });
}

/* POST /api/clientes { id?, nombre, rif, telefono, email, direccion, limite_credito, notas } */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'clientes.gestionar');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const nombre = String(cuerpo.nombre || '').trim();
  if (!nombre) return error('El nombre es obligatorio');
  const fila = {
    empresa_id: perfil.empresa_id,
    nombre,
    rif: cuerpo.rif || null,
    telefono: cuerpo.telefono || null,
    email: cuerpo.email || null,
    direccion: cuerpo.direccion || null,
    limite_credito: Number(cuerpo.limite_credito) || 0,
    notas: cuerpo.notas || null,
  };
  let id = cuerpo.id;
  if (id) {
    const { error: err } = await sb.from('clientes').update(fila).eq('empresa_id', perfil.empresa_id).eq('id', id);
    if (err) return error('No se pudo actualizar: ' + err.message, 500);
  } else {
    const { data, error: err } = await sb.from('clientes').insert(fila).select('id').single();
    if (err) return error('No se pudo crear: ' + err.message, 500);
    id = data.id;
  }
  await auditar(sb, perfil, { accion: 'cliente.guardar', entidad: 'cliente', entidadId: id, detalle: nombre });
  return Response.json({ ok: true, id });
}

export const GET = manejar(listar);
export const POST = manejar(guardar);

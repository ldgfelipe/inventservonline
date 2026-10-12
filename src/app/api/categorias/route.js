import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/categorias */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');
  const { data, error: err } = await sb.from('categorias')
    .select('*').eq('empresa_id', perfil.empresa_id).order('nombre');
  if (err) return error(err.message, 500);
  return Response.json({ ok: true, categorias: data || [] });
}

/* POST /api/categorias */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const nombre = String(cuerpo.nombre || '').trim();
  if (!nombre) return error('El nombre es obligatorio');

  const { data, error: err } = await sb.from('categorias')
    .insert({ empresa_id: perfil.empresa_id, nombre })
    .select('id').single();
  if (err) return error('No se pudo crear la categoria: ' + err.message, 500);

  await auditar(sb, perfil, { accion: 'categoria.crear', entidad: 'categoria', entidadId: data.id, detalle: nombre });
  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(guardar);

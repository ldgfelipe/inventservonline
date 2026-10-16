import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { exigirVigencia, revisarLimite } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* La tabla `almacenes` llega con la migracion 013. Si aun no esta
   aplicada se responde con datos vacios en vez de romper. */
function tablaFaltante(err) {
  return /almacenes|does not exist|schema cache|Could not find the table|relation/i.test(err.message || '');
}

/* GET /api/almacenes -> almacenes de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');

  const { data, error: err } = await sb.from('almacenes')
    .select('id, nombre, direccion, principal, activo, created_at')
    .eq('empresa_id', perfil.empresa_id)
    .order('principal', { ascending: false })
    .order('nombre');
  if (err) {
    if (tablaFaltante(err)) return Response.json({ ok: true, almacenes: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, almacenes: data || [] });
}

/* POST /api/almacenes { nombre, direccion } -> crea un almacen (plan Pro) */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const nombre = String(cuerpo.nombre || '').trim();
  if (!nombre) return error('El nombre del almacen es obligatorio');

  // Multi-almacen solo en el plan Pro. Ademas del flag del plan, el
  // limite de `almacenes` restringe a 1 ubicacion en free/basico.
  await exigirVigencia(sb, perfil);
  await revisarLimite(sb, perfil, 'almacenes');

  const fila = {
    empresa_id: perfil.empresa_id,
    nombre,
    direccion: cuerpo.direccion || null,
    principal: false,
    activo: true,
  };

  const { data, error: err } = await sb.from('almacenes').insert(fila).select('*').single();
  if (err) {
    if (tablaFaltante(err)) {
      return error('Multi-almacen no esta disponible: falta aplicar la migracion 013', 409);
    }
    return error('No se pudo crear el almacen: ' + err.message, 500);
  }

  await auditar(sb, perfil, { accion: 'almacen.crear', entidad: 'almacen', entidadId: data.id, detalle: nombre });
  return Response.json({ ok: true, almacen: data }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(crear);

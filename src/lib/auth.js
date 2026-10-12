import { conJwt, admin } from './supabase';

/* Extrae el token del header Authorization. */
export function tokenDe(request) {
  const cabecera = request.headers.get('authorization') || '';
  if (!cabecera.toLowerCase().startsWith('bearer ')) return null;
  return cabecera.slice(7).trim() || null;
}

/* Respuesta de error uniforme. */
export function error(mensaje, estado = 400) {
  return Response.json({ ok: false, error: mensaje }, { status: estado });
}

/* Verifica el token y devuelve { usuario, perfil } o lanza.
   El perfil trae empresa_id, rol y area: con eso se autoriza. */
export async function sesion(request) {
  const token = tokenDe(request);
  if (!token) throw new NoAutorizado('Sesion no iniciada');

  const sb = conJwt(token);
  const { data, error: err } = await sb.auth.getUser(token);
  if (err || !data?.user) throw new NoAutorizado('Sesion invalida o expirada');

  const { data: perfil, error: errPerfil } = await sb
    .from('perfiles')
    .select('id, empresa_id, nombre, rol, area, activo')
    .eq('id', data.user.id)
    .maybeSingle();

  if (errPerfil) throw new Error('No se pudo leer el perfil: ' + errPerfil.message);
  if (!perfil) throw new NoAutorizado('El usuario no tiene empresa asignada');
  if (!perfil.activo) throw new NoAutorizado('El usuario esta inactivo');

  return { usuario: data.user, perfil, token, sb };
}

/* Exige un permiso segun el rol del perfil. */
export function exigir(perfil, permiso) {
  const { permisosDeRol } = require('@/services/permisos');
  if (!permisosDeRol(perfil.rol).includes(permiso)) {
    throw new SinPermiso(`No tienes permiso para esta accion (${permiso})`);
  }
}

export class NoAutorizado extends Error {}
export class SinPermiso extends Error {}

/* Envuelve un handler: captura los errores de sesion y permiso. */
export function manejar(fn) {
  return async (request, contexto) => {
    try {
      return await fn(request, contexto);
    } catch (err) {
      if (err instanceof NoAutorizado) return error(err.message, 401);
      if (err instanceof SinPermiso) return error(err.message, 403);
      console.error(err);
      return error(err.message || 'Error interno', 500);
    }
  };
}

/* Registra un evento de uso (adopcion) sin romper la operacion. */
export async function auditar(sb, perfil, { accion, entidad, entidadId, detalle }) {
  if (!perfil) return;
  try {
    await sb.from('bitacora').insert({
      empresa_id: perfil.empresa_id,
      usuario_id: perfil.id,
      usuario: perfil.nombre,
      area: perfil.area,
      rol: perfil.rol,
      accion,
      entidad,
      entidad_id: entidadId ? String(entidadId) : null,
      detalle,
    });
  } catch (err) {
    console.error('No se pudo auditar:', err.message);
  }
}

export async function evento(sb, perfil, nombre, contexto) {
  if (!perfil) return;
  try {
    await sb.from('eventos_app').insert({
      empresa_id: perfil.empresa_id,
      usuario_id: perfil.id,
      usuario: perfil.nombre,
      area: perfil.area,
      rol: perfil.rol,
      evento: nombre,
      contexto: contexto || null,
    });
  } catch { /* las metricas nunca deben romper la operacion */ }
}

/* Perfil por token, para el middleware y rutas de auth. */
export async function perfilDeToken(token) {
  if (!token) return null;
  try {
    const sb = conJwt(token);
    const { data } = await sb.auth.getUser(token);
    if (!data?.user) return null;
    const { data: perfil } = await sb.from('perfiles').select('*').eq('id', data.user.id).maybeSingle();
    return perfil ? { usuario: data.user, perfil } : null;
  } catch {
    return null;
  }
}

export { admin };

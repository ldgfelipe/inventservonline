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

/* Forma publica del usuario para el cliente.
   IMPORTANTE: el renderer espera `permisos`, `rolNombre` y `nivel`.
   Si falta `permisos`, puedeUI() lanza TypeError y la aplicacion se
   queda congelada sin terminar de iniciar. */
export function usuarioPublico(perfil, extra = {}) {
  const { ROLES, permisosDeRol } = require('@/services/permisos');
  const rol = ROLES[perfil.rol] || { nombre: perfil.rol, nivel: 0, permisos: [] };
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    usuario: perfil.usuario || extra.email || null,
    email: extra.email || null,
    rol: perfil.rol,
    rolNombre: rol.nombre,
    nivel: rol.nivel,
    area: perfil.area,
    empresa_id: perfil.empresa_id,
    super_admin: !!perfil.super_admin,
    permisos: permisosDeRol(perfil.rol),
    ...extra,
  };
}

/* Verifica el token y devuelve { usuario, perfil, sb, sbRpc }.

   DISENO DE DATOS (por que hay dos clientes):

   - `sb`      cliente con service_role: para consultas a tablas. NO depende
               de las policies RLS, asi que el sistema funciona aunque el
               RLS este mal configurado. El aislamiento por empresa se
               aplica filtrando empresa_id en cada consulta (todas las
               rutas lo hacen).
   - `sbRpc`   cliente con el JWT del usuario: para llamar funciones
               (rpc). Las funciones derivan la empresa de auth.uid(), y
               con service_role ese valor es null, por lo que deben
               llamarse con el token del usuario.

   Ver el README: el RLS queda como segunda capa de defensa, no como
   la unica. */
export async function sesion(request) {
  const token = tokenDe(request);
  if (!token) throw new NoAutorizado('Sesion no iniciada');

  const sbUsuario = conJwt(token);
  const { data, error: err } = await sbUsuario.auth.getUser(token);
  if (err || !data?.user) throw new NoAutorizado('Sesion invalida o expirada');

  const sbAdmin = admin();
  const { data: perfil, error: errPerfil } = await sbAdmin
    .from('perfiles')
    .select('id, empresa_id, nombre, rol, area, activo, super_admin')
    .eq('id', data.user.id)
    .maybeSingle();

  if (errPerfil) throw new Error('No se pudo leer el perfil: ' + errPerfil.message);
  if (!perfil) throw new NoAutorizado('El usuario no tiene empresa asignada');
  if (!perfil.activo) throw new NoAutorizado('El usuario esta inactivo');

  return { usuario: data.user, perfil, token, sb: sbAdmin, sbRpc: sbUsuario };
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

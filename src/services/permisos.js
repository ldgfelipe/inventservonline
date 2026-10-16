/* Modelo de usuarios: niveles (roles), areas y permisos.

   Regla de diseno:
   - El NIVEL (rol) define QUE puede hacer un usuario.
   - El AREA define su ambito organizacional (se registra en cada
     movimiento y en la bitacora, y permite filtrar trazabilidad).
*/

const AREAS = [
  'Administracion',
  'Almacen',
  'Farmacia / Despacho',
  'Compras',
  'Ventas',
  'Contabilidad',
];

/* Catalogo de permisos. La clave se usa para autorizar cada accion. */
const PERMISOS = {
  'productos.ver': 'Ver productos',
  'productos.crear': 'Crear productos',
  'productos.editar': 'Editar productos',
  'productos.eliminar': 'Eliminar productos',
  'movimientos.ver': 'Ver movimientos',
  'movimientos.entrada': 'Registrar entradas de stock',
  'movimientos.salida': 'Registrar salidas de stock',
  'trazabilidad.ver': 'Ver trazabilidad del producto',
  'contabilidad.ver': 'Ver el area contable y el kardex valorizado',
  'reportes.ver': 'Ver reportes',
  'reportes.exportar': 'Exportar a Excel',
  'reportes.imprimir': 'Imprimir',
  'proveedores.ver': 'Ver proveedores',
  'proveedores.gestionar': 'Gestionar proveedores',
  'usuarios.gestionar': 'Gestionar usuarios y permisos',
  'bitacora.ver': 'Ver bitacora del sistema',
  'config.ver': 'Acceder a configuracion',
  'webhook.enviar': 'Enviar datos por webhook',
};

const TODOS = Object.keys(PERMISOS);

/* Matriz rol -> permisos. Para denegar solo un permiso a un rol se
   enlista explicitamente y se excluye el resto. */
const ROLES = {
  admin: {
    nombre: 'Administrador',
    nivel: 4,
    descripcion: 'Acceso total al sistema, usuarios y configuracion',
    permisos: TODOS,
  },
  supervisor: {
    nombre: 'Supervisor',
    nivel: 3,
    descripcion: 'Administra inventario y reportes; no gestiona usuarios',
    permisos: TODOS.filter(p => p !== 'usuarios.gestionar'),
  },
  almacenista: {
    nombre: 'Almacenista',
    nivel: 2,
    descripcion: 'Opera entradas y salidas; sin reportes sensibles ni configuracion',
    permisos: [
      'productos.ver',
      'productos.crear',
      'productos.editar',
      'movimientos.ver',
      'movimientos.entrada',
      'movimientos.salida',
      'trazabilidad.ver',
      'reportes.ver',
      'reportes.exportar',
      'reportes.imprimir',
      'proveedores.ver',
      'bitacora.ver',
    ],
  },
  consultor: {
    nombre: 'Consultor',
    nivel: 1,
    descripcion: 'Solo lectura: productos, reportes y trazabilidad',
    permisos: [
      'productos.ver',
      'movimientos.ver',
      'trazabilidad.ver',
      'contabilidad.ver',
      'reportes.ver',
      'proveedores.ver',
    ],
  },
};

const ROLES_VALIDOS = Object.keys(ROLES);

function rolValido(rol) {
  return ROLES_VALIDOS.includes(rol);
}

function permisosDeRol(rol) {
  return ROLES[rol] ? [...ROLES[rol].permisos] : [];
}

function puede(rol, permiso) {
  if (!rol) return false;
  if ('*' in (ROLES[rol] || {})) return true;
  return permisosDeRol(rol).includes(permiso);
}

function nivelDeRol(rol) {
  return ROLES[rol] ? ROLES[rol].nivel : 0;
}

function areaValida(area) {
  return AREAS.includes(area);
}

function areasParaUi() {
  return AREAS.map(a => ({ nombre: a }));
}

module.exports = {
  AREAS,
  PERMISOS,
  ROLES,
  ROLES_VALIDOS,
  rolValido,
  permisosDeRol,
  puede,
  nivelDeRol,
  areaValida,
  areasParaUi,
  TODOS,
};

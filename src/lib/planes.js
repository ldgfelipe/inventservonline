/* ============================================================
   Catalogo de planes del SaaS (freemium) + limites por plan.

   Modulo PURO (sin imports): lo usa el servidor (licenciamiento.js,
   rutas de API) y podria usarse en cualquier lado. El renderer NO lo
   importa: obtiene el catalogo por GET /api/planes.

   Los limites viven aqui (y no en la base) para que el sistema siga
   funcionando aunque la migracion 013 no este aplicada. Si mas adelante
   se quiere que un plan se pueda ajustar sin re-deploy, se puede leer
   una tabla `planes_limites` y usarla como override.
   ============================================================ */

/* Recursos que un plan puede limitar. La clave se usa en la API. */
export const RECURSOS = {
  productos: 'Productos',
  usuarios: 'Usuarios',
  proveedores: 'Proveedores',
  almacenes: 'Almacenes',
};

export function etiquetaRecurso(recurso) {
  return RECURSOS[recurso] || recurso;
}

/* Estados posibles de una suscripcion. */
export const ESTADOS = ['activo', 'trial', 'vencido', 'en_revision'];
export const ESTADO_POR_DEFECTO = 'activo';

/* Dias de prueba gratuita al registrarse. */
export const DIAS_PRUEBA = 14;

/* Plan que se otorga durante la prueba. Con 'pro' el cliente prueba TODO
   (incluido multi-almacen) antes de decidir; al vencer la prueba se le
   invita a elegir plan. Cambiar a 'free' si se prefiere una prueba con
   los limites del plan gratis. */
export const PLAN_EN_PRUEBA = 'pro';

/* limite null = ILIMITADO */
export const PLANES = {
  free: {
    codigo: 'free',
    nombre: 'Gratis',
    descripcion: 'Para empezar a ordenar el inventario sin pagar.',
    destacado: false,
    precio: { mensual: 0, anual: 0, moneda: 'USD' },
    multi_almacen: false,
    limites: { productos: 50, usuarios: 1, proveedores: 3, almacenes: 1, almacenamiento_mb: 100 },
    features: [
      '1 usuario',
      'Hasta 50 productos',
      'Hasta 3 proveedores',
      '100 MB de almacenamiento',
      'Entradas y salidas de stock',
      'Alertas de minimo, maximo y reorden',
      'Reportes e impresion',
    ],
  },
  basic: {
    codigo: 'basic',
    nombre: 'Basico',
    descripcion: 'Para negocios en crecimiento que ya venden todos los dias.',
    destacado: true,
    precio: { mensual: 9, anual: 90, moneda: 'USD' },
    multi_almacen: false,
    limites: { productos: 1500, usuarios: 3, proveedores: 15, almacenes: 1, almacenamiento_mb: 500 },
    features: [
      '3 usuarios',
      'Hasta 1.500 productos',
      'Hasta 15 proveedores',
      '500 MB de almacenamiento',
      'Contabilidad y Kardex valorizado',
      'Importacion CSV / Excel',
      'Asistente de inventario',
    ],
  },
  pro: {
    codigo: 'pro',
    nombre: 'Pro',
    descripcion: 'Sin limites y con multi-almacen.',
    destacado: false,
    precio: { mensual: 19, anual: 190, moneda: 'USD' },
    multi_almacen: true,
    limites: { productos: null, usuarios: null, proveedores: null, almacenes: null, almacenamiento_mb: 2048 },
    features: [
      'Usuarios y productos ilimitados',
      'Multi-almacen',
      '2 GB de almacenamiento',
      'Todo lo del plan Basico',
      'Soporte prioritario',
    ],
  },
};

export const PLAN_POR_DEFECTO = 'free';
export const PLANES_VALIDOS = Object.keys(PLANES);

export function planValido(codigo) {
  return PLANES_VALIDOS.includes(codigo);
}

export function planDe(codigo) {
  return PLANES[codigo] || PLANES[PLAN_POR_DEFECTO];
}

/* Devuelve el limite del recurso para el plan: numero o null (ilimitado). */
export function limiteDe(codigo, recurso) {
  const plan = planDe(codigo);
  const valor = plan.limites ? plan.limites[recurso] : null;
  return valor === undefined ? null : valor;
}

export function esIlimitado(codigo, recurso) {
  return limiteDe(codigo, recurso) === null;
}

export function multiAlmacen(codigo) {
  return !!planDe(codigo).multi_almacen;
}

export function estadoValido(estado) {
  return ESTADOS.includes(estado);
}

export function estadoVigente(estado) {
  return estado !== 'vencido';
}

/* Catalogo listo para enviar al cliente (JSON-safe). */
export function catalogoPlanes() {
  return PLANES_VALIDOS.map((c) => PLANES[c]);
}

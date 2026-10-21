/* ============================================================
   Catalogo de planes del SaaS (freemium) + limites por plan.
   
   MODULOS: cada plan define que modulos/funcionalidades incluye.
   El backend (licenciamiento.js) verifica el modulo antes de
   permitir la accion. El frontend oculta las secciones cuyo
   modulo no esta en el plan activo.

   Modulos disponibles:
   - inventario: productos, categorias, proveedores, movimientos
   - alertas: stock bajo, agotado, reorden, exceso
   - reportes_basicos: dashboard, reportes simples, impresion
   - reportes_avanzados: margen, rotacion, valorizacion, exportacion
   - contabilidad: kardex valorizado, costo promedio, COGS
   - importacion: CSV/Excel import
   - asistente: asistente de inventario
   - multi_almacen: almacenes multiples, traslados, stock por ubicacion
   - pos: ventas, cobros, caja
   - cxc: cuentas por cobrar
   - cxp: cuentas por pagar
   - facturacion: facturacion electronica (1 pais)
   - facturacion_multi: facturacion en multiples paises
   - api: acceso a API REST
   - usuarios_ilimitados: sin limite de usuarios
   - soporte_prioritario: soporte 24h
   - white_label: logo propio
   ============================================================ */

export const MODULOS = {
  inventario: 'Inventario basico',
  alertas: 'Alertas de stock',
  reportes_basicos: 'Reportes basicos',
  reportes_avanzados: 'Reportes avanzados',
  contabilidad: 'Contabilidad y Kardex',
  importacion: 'Importacion CSV/Excel',
  asistente: 'Asistente de inventario',
  multi_almacen: 'Multi-almacen',
  pos: 'POS / Cobranza',
  compras: 'Compras a proveedores',
  cxc: 'Cuentas por cobrar',
  cxp: 'Cuentas por pagar',
  facturacion: 'Facturacion electronica',
  facturacion_multi: 'Facturacion multi-pais',
  api: 'Acceso a API',
  usuarios_ilimitados: 'Usuarios ilimitados',
  soporte_prioritario: 'Soporte prioritario',
  white_label: 'Marca propia (white-label)',
};

export function etiquetaModulo(codigo) {
  return MODULOS[codigo] || codigo;
}

/* Recursos que un plan puede limitar. La clave se usa en la API. */
export const RECURSOS = {
  productos: 'Productos',
  usuarios: 'Usuarios',
  proveedores: 'Proveedores',
  clientes: 'Clientes',
  almacenes: 'Almacenes',
  almacenamiento_mb: 'Almacenamiento (MB)',
};

export function etiquetaRecurso(recurso) {
  return RECURSOS[recurso] || recurso;
}

/* Estados posibles de una suscripcion. */
export const ESTADOS = ['activo', 'trial', 'vencido', 'en_revision'];
export const ESTADO_POR_DEFECTO = 'activo';

/* Dias de prueba gratuita al registrarse. */
export const DIAS_PRUEBA = 14;

/* Plan que se otorga durante la prueba. */
export const PLAN_EN_PRUEBA = 'pro';

/* limite null = ILIMITADO */
export const PLANES = {
  free: {
    codigo: 'free',
    nombre: 'Gratis',
    descripcion: 'Para empezar a ordenar el inventario sin pagar.',
    destacado: false,
    precio: { mensual: 0, anual: 0, moneda: 'USD' },
    color: '#64748b',
    modulos: [
      'inventario',
      'alertas',
      'reportes_basicos',
    ],
    multi_almacen: false,
    limites: {
      productos: 50,
      usuarios: 1,
      proveedores: 3,
      clientes: 10,
      almacenes: 1,
      almacenamiento_mb: 100,
    },
    features: [
      '1 usuario',
      'Hasta 50 productos',
      'Hasta 3 proveedores',
      'Hasta 10 clientes',
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
    color: '#2563eb',
    modulos: [
      'inventario',
      'alertas',
      'reportes_basicos',
      'reportes_avanzados',
      'contabilidad',
      'importacion',
      'asistente',
    ],
    multi_almacen: false,
    limites: {
      productos: 1500,
      usuarios: 3,
      proveedores: 15,
      clientes: 100,
      almacenes: 1,
      almacenamiento_mb: 500,
    },
    features: [
      '3 usuarios',
      'Hasta 1.500 productos',
      'Hasta 15 proveedores',
      'Hasta 100 clientes',
      '500 MB de almacenamiento',
      'Contabilidad y Kardex valorizado',
      'Importacion CSV / Excel',
      'Asistente de inventario',
      'Reportes avanzados y exportacion',
    ],
  },
  pro: {
    codigo: 'pro',
    nombre: 'Profesional',
    descripcion: 'Sin limites y con multi-almacen, POS y facturacion.',
    destacado: false,
    precio: { mensual: 19, anual: 190, moneda: 'USD' },
    color: '#7c3aed',
    modulos: [
      'inventario',
      'alertas',
      'reportes_basicos',
      'reportes_avanzados',
      'contabilidad',
      'importacion',
      'asistente',
      'multi_almacen',
      'pos',
      'compras',
      'cxc',
      'cxp',
      'facturacion',
      'reportes_comerciales',
    ],
    multi_almacen: true,
    limites: {
      productos: null,
      usuarios: 10,
      proveedores: 50,
      clientes: 500,
      almacenes: 5,
      almacenamiento_mb: 2048,
    },
    features: [
      '10 usuarios',
      'Productos ilimitados',
      'Hasta 50 proveedores',
      'Hasta 500 clientes',
      '5 almacenes (multi-almacen)',
      '2 GB de almacenamiento',
      'POS / Cobranza',
      'Cuentas por cobrar y pagar',
      'Facturacion electronica (1 pais)',
      'Reportes comerciales',
      'Traslados entre almacenes',
    ],
  },
  empresa: {
    codigo: 'empresa',
    nombre: 'Empresa',
    descripcion: 'Para empresas que necesitan todo sin limites.',
    destacado: false,
    precio: { mensual: 49, anual: 490, moneda: 'USD' },
    color: '#0f172a',
    modulos: [
      'inventario',
      'alertas',
      'reportes_basicos',
      'reportes_avanzados',
      'contabilidad',
      'importacion',
      'asistente',
      'multi_almacen',
      'pos',
      'compras',
      'cxc',
      'cxp',
      'facturacion',
      'facturacion_multi',
      'api',
      'usuarios_ilimitados',
      'soporte_prioritario',
      'white_label',
    ],
    multi_almacen: true,
    limites: {
      productos: null,
      usuarios: null,
      proveedores: null,
      clientes: null,
      almacenes: null,
      almacenamiento_mb: 10240,
    },
    features: [
      'Usuarios ilimitados',
      'Productos ilimitados',
      'Almacenes ilimitados',
      '10 GB de almacenamiento',
      'Todo lo del plan Profesional',
      'Facturacion multi-pais',
      'Acceso a API REST',
      'Soporte prioritario (24h)',
      'White-label (logo propio)',
      'Backups automaticos',
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

/* Verifica si un plan incluye un modulo. */
export function tieneModulo(codigo, modulo) {
  const plan = planDe(codigo);
  return Array.isArray(plan.modulos) && plan.modulos.includes(modulo);
}

/* Lista de modulos de un plan. */
export function modulosDe(codigo) {
  const plan = planDe(codigo);
  return Array.isArray(plan.modulos) ? [...plan.modulos] : [];
}

export function estadoValido(estado) {
  return ESTADOS.includes(estado);
}

export function estadoVigente(estado) {
  return estado !== 'vencido';
}

export function catalogoPlanes() {
  return PLANES_VALIDOS.map((c) => PLANES[c]);
}

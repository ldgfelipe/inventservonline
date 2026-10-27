/* ============================================================
   Base de conocimiento de inventserOnline.
   Contenido estructurado para la pagina /ayuda con buscador.
   ============================================================ */

export const CATEGORIAS = [
  { id: 'general', nombre: 'General', icono: '📊' },
  { id: 'inventario', nombre: 'Inventario', icono: '📦' },
  { id: 'almacenes', nombre: 'Multi-almacen', icono: '🏬' },
  { id: 'comercial', nombre: 'Comercial / POS', icono: '🛒' },
  { id: 'caja', nombre: 'Caja y arqueo', icono: '💰' },
  { id: 'contabilidad', nombre: 'Contabilidad', icono: '📈' },
  { id: 'facturacion', nombre: 'Facturacion', icono: '🧾' },
  { id: 'reportes', nombre: 'Reportes', icono: '📋' },
  { id: 'configuracion', nombre: 'Configuracion', icono: '⚙️' },
  { id: 'administracion', nombre: 'Administracion', icono: '🔐' },
  { id: 'asistente', nombre: 'Asistente', icono: '✨' },
];

export const ARTICULOS = [
  /* ---------------- GENERAL ---------------- */
  {
    id: 'que-es-inventser',
    categoria: 'general',
    titulo: '¿Que es inventserOnline?',
    descripcion: 'Sistema de inventarios en la nube, multi-empresa, con control de stock, ventas, compras, contabilidad y facturacion.',
    palabrasClave: ['inventario', 'sistema', 'nube', 'multiempresa', 'saas', 'que es'],
    contenido: `inventserOnline es un sistema de gestion de inventarios y punto de venta en la nube. Permite a cada empresa controlar sus productos, entradas, salidas, almacenes, ventas, compras, clientes, proveedores, caja y facturacion desde cualquier dispositivo con navegador.

Cada empresa es un inquilino independiente: sus datos estan aislados por empresa_id, de modo que ninguna empresa puede ver los datos de otra.

Funciona con planes freemium: Gratis, Basico, Profesional y Empresa.`,
  },
  {
    id: 'dashboard',
    categoria: 'general',
    titulo: 'Dashboard (panel principal)',
    descripcion: 'Vista general con metricas de productos, unidades, valor del inventario, alertas y movimientos del dia.',
    palabrasClave: ['dashboard', 'inicio', 'panel', 'metricas', 'resumen', 'valor inventario', 'stock bajo', 'agotados'],
    contenido: `El Dashboard muestra:
- Total de productos activos.
- Unidades en stock.
- Valor del inventario a costo y a venta.
- Productos bajo el minimo, por reordenar, sobre el maximo y agotados.
- Movimientos de hoy.
- Widget de stock por almacen (si el plan incluye multi-almacen).
- Alertas ordenadas por gravedad.

Desde el dashboard puedes navegar a cualquier seccion usando el menu lateral.`,
  },
  {
    id: 'roles-permisos',
    categoria: 'general',
    titulo: 'Roles y permisos',
    descripcion: 'Administrador, Supervisor, Almacenista y Consultor con distintos niveles de acceso.',
    palabrasClave: ['roles', 'permisos', 'admin', 'supervisor', 'almacenista', 'consultor', 'acceso'],
    contenido: `Roles disponibles:
- Administrador: acceso total, incluidos usuarios y configuracion.
- Supervisor: todo lo operativo y reportes, sin gestionar usuarios.
- Almacenista: entradas/salidas y productos; sin usuarios, config ni webhook.
- Consultor: solo lectura (productos, reportes, contabilidad, CxC, CxP).

Los permisos se validan en el servidor en cada ruta. Ocultar un boton en la interfaz no es control de acceso.`,
  },
  {
    id: 'navegacion',
    categoria: 'general',
    titulo: 'Navegacion y menu',
    descripcion: 'Menu lateral con todas las secciones; en movil se abre con el boton hamburguesa.',
    palabrasClave: ['menu', 'navegacion', 'movil', 'responsive', 'hamburguesa'],
    contenido: `El menu lateral agrupa todas las secciones: Dashboard, Productos, Movimientos, Proveedores, Clientes, Ventas, Compras, CxC, CxP, Caja, Reportes, Traslados, Stock por almacen, Contabilidad, Bitacora, Usuarios y Configuracion.

En dispositivos moviles, el menu se abre con el boton de hamburguesa (☰) en la barra superior y se cierra tocando fuera o seleccionando una opcion.`,
  },

  /* ---------------- INVENTARIO ---------------- */
  {
    id: 'productos',
    categoria: 'inventario',
    titulo: 'Productos',
    descripcion: 'Crear, editar y eliminar productos con codigo, nombre, precios, stock minimo/maximo y campos por giro.',
    palabrasClave: ['productos', 'crear producto', 'codigo', 'precio', 'stock minimo', 'stock maximo', 'reorden', 'categoria', 'campos personalizados'],
    contenido: `En Productos puedes:
- Crear productos con codigo unico, nombre, categoria, proveedor.
- Definir stock minimo, maximo y punto de reorden.
- Precio de compra y venta.
- Unidad de medida (unidad, caja, kg, etc.).
- Lote y fecha de vencimiento.
- Ubicacion fisica en almacen.
- Campos personalizados segun el giro del negocio.

El costo promedio se calcula automaticamente con las entradas (costo promedio ponderado). El stock actual es el total consolidado de todos los almacenes.`,
  },
  {
    id: 'movimientos',
    categoria: 'inventario',
    titulo: 'Movimientos de stock',
    descripcion: 'Registrar entradas y salidas con trazabilidad completa: usuario, area, costo, stock resultante y saldo valorizado.',
    palabrasClave: ['movimientos', 'entrada', 'salida', 'stock', 'trazabilidad', 'kardex', 'costo'],
    contenido: `Cada movimiento registra:
- Tipo (entrada o salida).
- Producto, cantidad, precio unitario.
- Costo unitario y costo total (valorizacion).
- Stock resultante y saldo valorizado.
- Usuario, area, rol, documento y observacion.
- Almacen (si aplica).

Las entradas actualizan el costo promedio ponderado. Las salidas se valorizan al costo promedio vigente. No se permite una salida mayor al stock disponible.`,
  },
  {
    id: 'alertas-stock',
    categoria: 'inventario',
    titulo: 'Alertas de stock',
    descripcion: 'Estados: agotado, bajo, exceso y por reordenar. Configurables por empresa.',
    palabrasClave: ['alertas', 'stock bajo', 'agotado', 'exceso', 'reorden', 'minimo', 'maximo'],
    contenido: `Cada producto tiene un estado de alerta calculado en el servidor:
- Agotado: stock actual <= 0.
- Bajo: stock actual <= stock minimo.
- Exceso: stock actual > stock maximo.
- Por reordenar: stock actual <= punto de reorden.
- OK: dentro de los parametros.

Puedes filtrar productos por estado de alerta desde la vista Productos.`,
  },
  {
    id: 'importar-exportar',
    categoria: 'inventario',
    titulo: 'Importar y exportar',
    descripcion: 'Cargar productos desde CSV/Excel con vista previa y exportar a Excel.',
    palabrasClave: ['importar', 'exportar', 'excel', 'csv', 'carga masiva'],
    contenido: `Importacion: carga un archivo CSV o Excel; el sistema analiza las columnas, detecta duplicados y muestra una vista previa antes de aplicar. Puedes elegir como resolver duplicados.

Exportacion: exporta productos, movimientos, bitacora, ventas, traslados, CxC y CxP a Excel (.xlsx) con formato y filtros automaticos.

La importacion requiere permiso productos.crear; la exportacion requiere reportes.exportar.`,
  },

  /* ---------------- ALMACENES ---------------- */
  {
    id: 'almacenes',
    categoria: 'almacenes',
    titulo: 'Multi-almacen',
    descripcion: 'Gestionar varias ubicaciones con stock independiente y stock consolidado.',
    palabrasClave: ['almacen', 'multi-almacen', 'ubicacion', 'sucursal', 'bodega'],
    contenido: `Cada empresa tiene un almacen "Principal" por defecto. Los planes Pro y Empresa permiten crear almacenes adicionales.

Cada producto mantiene:
- Stock total (productos.stock_actual).
- Desglose por almacen (producto_almacen).

El stock total es la suma de todos los almacenes. Puedes ver el desglose en la ficha del producto y en la vista "Stock por almacen".`,
  },
  {
    id: 'traslados',
    categoria: 'almacenes',
    titulo: 'Traslados entre almacenes',
    descripcion: 'Mover stock de un almacen a otro con registro de origen, destino y cantidad.',
    palabrasClave: ['traslado', 'mover stock', 'transferencia', 'entre almacenes'],
    contenido: `Un traslado registra una salida en el almacen de origen y una entrada en el destino, de forma atomica.

Pasos: Traslados → + Traslado → selecciona producto, almacen origen, almacen destino, cantidad y observacion.

El reporte de traslados permite filtrar por fecha y exportar a Excel.`,
  },
  {
    id: 'stock-almacen',
    categoria: 'almacenes',
    titulo: 'Stock por almacen',
    descripcion: 'Tabla comparativa con productos en filas y almacenes en columnas.',
    palabrasClave: ['stock por almacen', 'desglose', 'inventario por ubicacion'],
    contenido: `La vista "Stock por almacen" muestra una tabla con:
- Producto y codigo.
- Stock total y stock minimo.
- Cantidad en cada almacen (columna por almacen).

El almacen principal se marca con (P).`,
  },

  /* ---------------- COMERCIAL ---------------- */
  {
    id: 'clientes',
    categoria: 'comercial',
    titulo: 'Clientes',
    descripcion: 'Gestionar clientes con nombre, RIF, telefono, email, direccion y limite de credito.',
    palabrasClave: ['clientes', 'cliente', 'rif', 'credito'],
    contenido: `En Clientes puedes crear y editar clientes. Cada cliente se asocia a ventas y cuentas por cobrar.

Puedes iniciar un cobro directamente desde la lista de clientes.`,
  },
  {
    id: 'ventas-pos',
    categoria: 'comercial',
    titulo: 'Ventas (POS)',
    descripcion: 'Registrar ventas con carrito, descuentos, impuestos y salida automatica de stock.',
    palabrasClave: ['ventas', 'pos', 'punto de venta', 'carrito', 'facturar', 'vender'],
    contenido: `El POS permite:
- Seleccionar cliente (o venta de mostrador).
- Agregar productos al carrito con cantidad, precio y descuento.
- Aplicar descuento global e impuesto.
- Elegir almacen de salida.
- Confirmar la venta.

Al confirmar, se crea la venta, su detalle, se descuenta el stock (salida) y se genera una cuenta por cobrar.`,
  },
  {
    id: 'cobros',
    categoria: 'comercial',
    titulo: 'Cobros',
    descripcion: 'Registrar pagos de clientes (efectivo, tarjeta, transferencia) y aplicarlos a facturas.',
    palabrasClave: ['cobros', 'pagos', 'abono', 'efectivo', 'tarjeta', 'transferencia'],
    contenido: `Un cobro registra el pago de un cliente. Puede aplicarse a una venta especifica o, si no se indica, se aplica en orden FIFO a las cuentas por cobrar pendientes del cliente.

Metodos: efectivo, tarjeta, transferencia, otro. Cada cobro alimenta el resumen de caja.`,
  },
  {
    id: 'cxc',
    categoria: 'comercial',
    titulo: 'Cuentas por cobrar (CxC)',
    descripcion: 'Saldos pendientes de clientes con estado y antiguedad.',
    palabrasClave: ['cxc', 'cuentas por cobrar', 'deuda', 'saldo', 'antiguedad'],
    contenido: `Cada venta genera una cuenta por cobrar. Su estado pasa de pendiente a parcial y luego a pagada segun los cobros.

La vista muestra monto total, cobrado, saldo y estado. El reporte de antiguedad agrupa los saldos en rangos: 0-30, 31-60, 61-90 y 90+ dias.`,
  },
  {
    id: 'compras',
    categoria: 'comercial',
    titulo: 'Compras a proveedores',
    descripcion: 'Registrar compras con entrada automatica de stock y generacion de cuenta por pagar.',
    palabrasClave: ['compras', 'proveedores', 'entrada de stock', 'compra'],
    contenido: `Una compra registra los productos adquiridos a un proveedor. Al confirmar:
- Se crea la compra y su detalle.
- Se incrementa el stock (entrada) y se recalcula el costo promedio.
- Se genera una cuenta por pagar (CxP).

Puedes elegir el almacen de destino.`,
  },
  {
    id: 'cxp',
    categoria: 'comercial',
    titulo: 'Cuentas por pagar (CxP)',
    descripcion: 'Saldos pendientes con proveedores, pagos y antiguedad.',
    palabrasClave: ['cxp', 'cuentas por pagar', 'deuda proveedor', 'pago proveedor'],
    contenido: `Cada compra genera una cuenta por pagar. Los pagos a proveedores actualizan el saldo.

Puedes pagar una compra especifica o aplicar el pago en orden FIFO a las cuentas pendientes del proveedor.

El reporte de antiguedad agrupa los saldos por rangos de dias.`,
  },

  /* ---------------- CAJA ---------------- */
  {
    id: 'caja',
    categoria: 'caja',
    titulo: 'Caja del dia',
    descripcion: 'Resumen de cobros del dia por metodo de pago.',
    palabrasClave: ['caja', 'cobros del dia', 'efectivo', 'resumen'],
    contenido: `La vista Caja muestra el total cobrado hoy y el desglose por metodo (efectivo, tarjeta, transferencia, otro).`,
  },
  {
    id: 'cierre-caja',
    categoria: 'caja',
    titulo: 'Apertura y cierre de caja (arqueo)',
    descripcion: 'Abrir caja con monto inicial, cerrar con monto real y calcular diferencia.',
    palabrasClave: ['cierre', 'apertura', 'arqueo', 'diferencia', 'caja'],
    contenido: `Apertura: registra el monto inicial de caja.

Cierre: el sistema calcula el monto esperado (inicial + cobros del periodo) y lo compara con el monto real ingresado, mostrando la diferencia.

El cierre detallado muestra el desglose esperado por metodo de pago.`,
  },

  /* ---------------- CONTABILIDAD ---------------- */
  {
    id: 'contabilidad',
    categoria: 'contabilidad',
    titulo: 'Contabilidad y Kardex valorizado',
    descripcion: 'Resumen contable, costo de lo vendido, margen y kardex detallado.',
    palabrasClave: ['contabilidad', 'kardex', 'costo promedio', 'cogs', 'margen', 'valorizacion'],
    contenido: `La seccion Contabilidad incluye:
- Resumen del periodo: valor del inventario, costo de lo vendido (COGS) y margen.
- Kardex valorizado: cada movimiento con costo unitario, costo total y saldo.
- Desglose por categoria.

Usa costo promedio ponderado. El margen se calcula como ventas menos costo de lo vendido.`,
  },

  /* ---------------- FACTURACION ---------------- */
  {
    id: 'iva',
    categoria: 'facturacion',
    titulo: 'Tasa de IVA',
    descripcion: 'Configurar el porcentaje de IVA por empresa.',
    palabrasClave: ['iva', 'impuesto', 'tasa', 'facturacion'],
    contenido: `En Configuracion → General puedes definir la tasa de IVA (0-100%). Se usa en la factura impresa y como referencia para el timbrado electronico.`,
  },
  {
    id: 'factura-pdf',
    categoria: 'facturacion',
    titulo: 'Factura en PDF',
    descripcion: 'Generar e imprimir facturas en PDF desde una venta.',
    palabrasClave: ['factura', 'pdf', 'imprimir', 'comprobante'],
    contenido: `En Ventas, cada fila tiene los botones:
- Ver: resumen de la venta.
- Factura: factura en HTML para imprimir.
- PDF: descarga la factura en PDF.
- Timbrar: facturacion electronica (si esta configurada).

La factura incluye empresa, RIF, cliente, productos, subtotal, descuento, IVA y total.`,
  },
  {
    id: 'facturacion-electronica',
    categoria: 'facturacion',
    titulo: 'Facturacion electronica',
    descripcion: 'Timbrado CFDI (Mexico), UBL (Colombia/Peru), DTE (Chile), WSFE (Argentina), FacturaE (Espana).',
    palabrasClave: ['facturacion electronica', 'cfdi', 'sat', 'dian', 'afip', 'sii', 'sunat', 'aeat', 'facturama', 'sw sapien', 'timbrado'],
    contenido: `Proveedores soportados:
- Mexico: Facturama, SW Sapien, SAT directo (FIEL).
- Colombia: DIAN (UBL 2.1).
- Peru: SUNAT (UBL 2.1).
- Argentina: AFIP (WSAA + WSFE).
- Chile: SII (DTE).
- Espana: AEAT (FacturaE).

Configuracion: Configuracion → Facturacion → pais, proveedor, credenciales (JSON), RFC/NIT/RUT/CUIT, regimen fiscal, serie y folio.

Si tu proveedor o pais no esta soportado, puedes solicitar la integracion. El super-admin gestiona las solicitudes en /admin.`,
  },

  /* ---------------- REPORTES ---------------- */
  {
    id: 'reportes',
    categoria: 'reportes',
    titulo: 'Reportes comerciales',
    descripcion: 'Ventas con margen, antiguedad de CxC/CxP y caja por periodo.',
    palabrasClave: ['reportes', 'margen', 'ventas', 'antiguedad', 'caja', 'exportar'],
    contenido: `Reportes disponibles:
- Ventas y margen: total, costo, margen y % por venta.
- Antiguedad CxC: saldos por rango de dias.
- Antiguedad CxP: saldos por rango de dias.
- Caja por dia: total, por metodo y por dia.

Todos se pueden exportar a Excel.`,
  },
  {
    id: 'bitacora',
    categoria: 'reportes',
    titulo: 'Bitacora y trazabilidad',
    descripcion: 'Registro auditable de acciones y trazabilidad completa de un producto.',
    palabrasClave: ['bitacora', 'auditoria', 'trazabilidad', 'historial'],
    contenido: `La Bitacora registra cada accion relevante con usuario, area, rol, fecha y detalle.

La trazabilidad de un producto muestra su historial de movimientos, eventos administrativos, campos del giro y stock por almacen.`,
  },

  /* ---------------- CONFIGURACION ---------------- */
  {
    id: 'config-empresa',
    categoria: 'configuracion',
    titulo: 'Empresa, pais, moneda e IVA',
    descripcion: 'Configurar nombre, RIF, pais, moneda, tasa de IVA y logo.',
    palabrasClave: ['empresa', 'pais', 'moneda', 'iva', 'logo', 'rif'],
    contenido: `La seccion Configuracion esta organizada en pestanas: General, Catalogo, Plan y pagos, Notificaciones, Facturacion y Sistema. Cada pestana agrupa los ajustes relacionados.

En Configuracion → General puedes:
- Cambiar el nombre y RIF.
- Seleccionar pais y moneda (la moneda solo cambia la presentacion; no convierte valores).
- Definir la tasa de IVA.
- Subir el logo de la empresa (PNG/JPG).

La moneda se usa en todo el sistema para formatear montos.`,
  },
  {
    id: 'config-alertas',
    categoria: 'configuracion',
    titulo: 'Configuracion de alertas',
    descripcion: 'Elegir que alertas se generan y sus umbrales.',
    palabrasClave: ['alertas', 'configuracion', 'umbral', 'notificaciones'],
    contenido: `En Configuracion → Notificaciones puedes activar/desactivar:
- Stock bajo, stock agotado, stock agotado por almacen.
- CxC vencida, CxP vencida.
- Diferencia en caja.

Tambien defines el umbral de stock (% del minimo) y los dias de gracia para CxC.`,
  },
  {
    id: 'config-email',
    categoria: 'configuracion',
    titulo: 'Notificaciones por correo',
    descripcion: 'Configurar SMTP para recibir alertas por email.',
    palabrasClave: ['email', 'correo', 'smtp', 'notificaciones'],
    contenido: `Configuracion → Notificaciones. Configura el servidor SMTP (host, puerto, usuario, contrasena), remitente y destinatarios.

Cuando se generan alertas, se envia un resumen por email si la configuracion esta activa. Puedes enviar un correo de prueba desde el panel.`,
  },
  {
    id: 'config-whatsapp',
    categoria: 'configuracion',
    titulo: 'Notificaciones por WhatsApp',
    descripcion: 'Configurar WhatsApp Business Cloud API (Meta) para alertas.',
    palabrasClave: ['whatsapp', 'meta', 'notificaciones', 'cloud api'],
    contenido: `Configuracion → Notificaciones. Configura Phone Number ID, Access Token y telefonos destino (con codigo de pais).

Las alertas se envian por WhatsApp cuando la configuracion esta activa. Puedes enviar un mensaje de prueba.`,
  },
  {
    id: 'suscripcion',
    categoria: 'configuracion',
    titulo: 'Suscripcion y planes',
    descripcion: 'Ver plan actual, consumo, vigencia y comparativo de planes.',
    palabrasClave: ['suscripcion', 'plan', 'pago', 'upgrade', 'limite', 'consumo'],
    contenido: `En Configuracion → Plan y pagos puedes:
- Ver tu plan actual, estado y vigencia.
- Ver el consumo frente a los limites (productos, usuarios, proveedores, almacenes).
- Comparar planes.
- Pagar con Stripe, Mercado Pago, PayPal o transferencia bancaria.

Si alcanzas un limite, la API responde 403 PlanLimitReached y se abre el modal de upgrade.`,
  },
  {
    id: 'categorias-campos',
    categoria: 'configuracion',
    titulo: 'Categorias y campos personalizados',
    descripcion: 'Organizar productos por categoria y agregar campos segun el giro.',
    palabrasClave: ['categorias', 'campos personalizados', 'giro'],
    contenido: `Las categorias agrupan productos. Puedes crear categorias desde Configuracion → Catalogo.

Los campos personalizados del giro permiten agregar atributos especificos (lote, espesor, principio activo, etc.) que se piden al crear productos.`,
  },

  /* ---------------- ADMINISTRACION ---------------- */
  {
    id: 'admin-panel',
    categoria: 'administracion',
    titulo: 'Panel de administracion (/admin)',
    descripcion: 'Panel exclusivo del super-admin: dashboard SaaS, empresas, pagos, marketing y configuracion del sistema.',
    palabrasClave: ['admin', 'panel', 'superadmin', 'dashboard saas', 'empresas'],
    contenido: `El panel /admin es exclusivo para super-administradores. Incluye:
- Configuracion del sistema (feature flags).
- Dashboard del SaaS (MRR, ARR, empresas por plan, conversion).
- Empresas registradas (cambiar plan, suspender, reactivar, extender trial).
- Pagos pendientes (aprobar/rechazar transferencias).
- Solicitudes de facturacion electronica.
- Marketing y conversion (freemium, scoring, pixeles).
- Claves de administrador.

Para acceder, el perfil debe tener super_admin = true.`,
  },
  {
    id: 'planes-limites',
    categoria: 'administracion',
    titulo: 'Planes y limites',
    descripcion: 'Gratis, Basico, Profesional y Empresa con distintos limites y modulos.',
    palabrasClave: ['planes', 'limites', 'precios', 'freemium', 'gratis', 'basico', 'pro', 'empresa'],
    contenido: `Planes:
- Gratis ($0): 1 usuario, 50 productos, 3 proveedores, 10 clientes, 1 almacen, 100 MB.
- Basico ($9/mes): 3 usuarios, 1.500 productos, 15 proveedores, 100 clientes, 1 almacen, 500 MB, contabilidad, importacion, asistente.
- Profesional ($19/mes): 10 usuarios, productos ilimitados, multi-almacen, POS, CxC, CxP, facturacion (1 pais), reportes comerciales.
- Empresa ($49/mes): usuarios/almacenes ilimitados, 10 GB, facturacion multi-pais, API, soporte prioritario, white-label.

Los limites se validan en el servidor antes de crear registros. La pagina publica de precios esta en /precios.`,
  },
  {
    id: 'usuarios',
    categoria: 'administracion',
    titulo: 'Gestion de usuarios',
    descripcion: 'Crear usuarios, asignar roles y areas, cambiar contrasenas.',
    palabrasClave: ['usuarios', 'crear usuario', 'rol', 'contrasena', 'permisos'],
    contenido: `En Usuarios (solo admin de empresa) puedes:
- Crear usuarios con nombre, email, rol y area.
- Editar rol/area y activar/desactivar.
- Resetear contrasena.
- Eliminar usuarios.

El primer usuario de cada empresa es administrador. Los limites de usuarios dependen del plan.`,
  },
  {
    id: 'pagos-saas',
    categoria: 'administracion',
    titulo: 'Pagos del SaaS',
    descripcion: 'Stripe, Mercado Pago, PayPal y transferencia manual.',
    palabrasClave: ['pagos', 'stripe', 'mercadopago', 'paypal', 'transferencia', 'webhook'],
    contenido: `Metodos de pago:
- Stripe (Checkout).
- Mercado Pago (Preferences).
- PayPal (Orders v2).
- Transferencia bancaria (comprobante, aprobacion manual).

Los webhooks confirman el pago y activan el plan. Las transferencias quedan en revision hasta que el super-admin las aprueba en /admin.`,
  },
  {
    id: 'marketing',
    categoria: 'administracion',
    titulo: 'Marketing y pixeles',
    descripcion: 'Analisis de usuarios freemium, probabilidad de conversion y configuracion de pixeles.',
    palabrasClave: ['marketing', 'freemium', 'scoring', 'conversion', 'pixeles', 'google analytics', 'tag manager'],
    contenido: `El panel de marketing (super-admin) permite:
- Ver usuarios freemium con probabilidad de conversion (scoring 0-100).
- Identificar empresas con alta probabilidad de upgrade.
- Configurar pixeles de seguimiento: Google Analytics 4, Google Tag Manager y codigo personalizado en head/body.

El rastreo de campanas, trafico y conversiones se lleva con herramientas externas
(Google Analytics, Tag Manager, etc.), no en la base de datos del sistema.`,
  },
  {
    id: 'ab-testing',
    categoria: 'administracion',
    titulo: 'A/B testing (feature flags)',
    descripcion: 'Activar funcionalidades por porcentaje o por empresa y asignar variantes A/B.',
    palabrasClave: ['ab testing', 'feature flags', 'experimentos', 'variantes'],
    contenido: `Los feature flags permiten activar funcionalidades de forma controlada:
- Global (todos).
- Por porcentaje (rollout determinista).
- Por lista de empresas (beta).

Los experimentos asignan una variante A o B por empresa de forma determinista y persistente.

El super-admin gestiona los flags en /admin → Configuracion del sistema.`,
  },

  /* ---------------- ASISTENTE ---------------- */
  {
    id: 'asistente',
    categoria: 'asistente',
    titulo: 'Asistente de inventario',
    descripcion: 'Consultas en lenguaje natural sobre stock, ventas, CxC, CxP, caja y mas.',
    palabrasClave: ['asistente', 'chat', 'consultas', 'lenguaje natural'],
    contenido: `El asistente entiende frases como:
- "cuanto arroz tengo"
- "stock bajo"
- "productos agotados"
- "valor del inventario"
- "ventas de hoy"
- "cuentas por cobrar"
- "cuentas por pagar"
- "caja del dia"
- "margen de ganancia"
- "traslados recientes"
- "stock por almacen"

Puede proponer registrar entradas o salidas. Las acciones requieren confirmacion.`,
  },
];

/* Busca articulos por texto en titulo, descripcion, contenido y palabras clave. */
export function buscarArticulos(texto) {
  if (!texto || !texto.trim()) return ARTICULOS;
  const terminos = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
  return ARTICULOS.filter((a) => {
    const haystack = [a.titulo, a.descripcion, a.contenido, (a.palabrasClave || []).join(' ')]
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return terminos.every((t) => haystack.includes(t));
  });
}

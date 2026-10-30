/* i18n simple sin dependencias externas.
   - translations: objeto con clave->texto para es y en (y futuros idiomas).
   - detectLocale(value): devuelve 'es' | 'en' a partir del valor de la cookie.
   - t(key, locale): devuelve la traducción o la propia clave si no existe.
   - setLanguageClient(l): escribe la cookie y recarga (cliente).
*/
const translations = {
  es: {
    // --- Landing / Página principal ---
    home_hero_title: 'Sistema de inventarios online para controlar tu stock sin Excel',
    home_hero_subtitle: 'Controla entradas, salidas, ventas, compras y almacenes desde cualquier equipo.',
    home_hero_cta_gratis: 'Empieza gratis',
    home_hero_cta_planos: 'Ver planes y precios',
    home_benefit_planes: 'Planes desde $0',
    home_benefit_planes_desc: 'Empieza gratis y sube a Basico, Profesional o Empresa cuando tu negocio lo necesite. Sin permanencia.',
    home_benefit_se_adapta: 'Se adapta a tu giro',
    home_benefit_se_adapta_desc: 'Construccion, farmacia, abarrotes o cualquier otro giro. Configura tus propios campos sin tocar codigo.',
    home_benefit_entradas_salidas: 'Entradas y salidas',
    home_benefit_entradas_salidas_desc: 'Registra cada movimiento con trazabilidad: quien lo hizo, cuando y desde que area.',
    home_benefit_reportes_excel: 'Reportes y Excel',
    home_benefit_reportes_excel_desc: 'Exporta tu inventario y movimientos a Excel, o imprime reportes desde el navegador.',
    home_benefit_asistente: 'Asistente incluido',
    home_benefit_asistente_desc: 'Pregunta en lenguaje natural: &ldquo;¿cuanto cemento tengo?&rdquo; o pide registrar una entrada.',
    home_benefit_usuarios: 'Usuarios y permisos',
    home_benefit_usuarios_desc: 'Administrador, supervisor, almacenista o consultor. Cada rol ve y hace solo lo que le corresponde.',
    home_benefit_carga_masiva: 'Carga masiva',
    home_benefit_carga_masiva_desc: 'Importa tu catalogo desde CSV o Excel. Detecta duplicados y te muestra una vista previa antes de aplicar.',
    home_benefit_multi_almacen: 'Multi-almacen',
    home_benefit_multi_almacen_desc: 'Controla existencias por bodega, registra traslados y consulta el stock de cada ubicacion.',
    home_para_quien_title: '¿Para qué tipo de negocios sirve?',
    home_ferreterias: 'Ferreterías y materiales de construcción',
    home_farmacias: 'Farmacias y distribuidoras de medicamentos',
    home_abarrotes: 'Abarrotes, minisúpers y tiendas de conveniencia',
    home_repuestos: 'Repuestos, autopartes y talleres',
    home_cosmeticos: 'Cosméticos, papelerías y tiendas de retail',
    home_distribuidores: 'Distribuidores mayoristas y bodegas',
    home_restaurantes: 'Restaurantes y negocios con insumos',
    home_como_funciona_title: '¿Cómo funciona?',
    home_paso1_title: 'Crea tu cuenta gratis',
    home_paso1_desc: 'Registra tu empresa, elige tu país y moneda, y define el giro del negocio.',
    home_paso2_title: 'Carga tus productos',
    home_paso2_desc: 'Agrega productos manualmente o importa tu catálogo desde CSV o Excel.',
    home_paso3_title: 'Controla y decide',
    home_paso3_desc: 'Registra movimientos, revisa reportes y usa el asistente para detectar qué reponer.',
    home_planes_title: 'Planes y precios',
    home_empezar_gratis: 'Empieza gratis',
    home_cambio_plan: 'Cambia de plan cuando lo necesites',
    home_precios_usd: 'Precios en USD',
    home_personalizado_title: '¿Necesitas un sistema a medida?',
    home_personalizado_desc: 'Si tu negocio requiere módulos especiales, integraciones con otros sistemas o una solución personalizada, podemos desarrollarla para ti.',
    home_contacto_whatsapp: 'Contactar por WhatsApp',
    home_contacto_correo: 'Escribir por correo',
    // --- FAQs ---
    faq_q1: '¿Qué es inventserOnline?',
    faq_a1: 'Es un sistema de inventarios online que permite controlar el stock, registrar entradas y salidas, gestionar varios almacenes, ventas, compras, cuentas por cobrar y por pagar, y consultar reportes desde cualquier navegador, sin instalar nada.',
    faq_q2: '¿Sirve para cualquier tipo de negocio?',
    faq_a2: 'Sí. Se adapta a ferreterías, farmacias, abarrotes, construcción, repuestos, cosméticos, papelerías y cualquier giro. Cada empresa configura sus propios campos de producto, categorías y almacenes.',
    faq_q3: '¿Puedo probarlo gratis?',
    faq_a3: 'Sí. Todas las cuentas nuevas incluyen 14 días de prueba gratis con las funciones del plan Profesional. No se requiere tarjeta de crédito para comenzar.',
    faq_q4: '¿Puedo dejar de usar Excel?',
    faq_a4: 'Sí. inventserOnline reemplaza las hojas de cálculo para el control de inventario: registra movimientos con trazabilidad, calcula el kardex valorizado, alerta sobre stock bajo y permite exportar a Excel cuando lo necesites.',
    faq_q5: '¿Funciona con varios almacenes o sucursales?',
    faq_a5: 'Sí. Los planes Profesional y Empresa incluyen multi-almacén, traslados entre bodegas, stock por almacén y reportes de rendimiento por ubicación.',
    faq_q6: '¿Incluye facturación electrónica?',
    faq_a6: 'Sí, según el país y el proveedor fiscal configurado. El sistema soporta Facturama y SW Sapien en México, DIAN en Colombia, AFIP en Argentina, SUNAT en Perú, SII en Chile, AEAT en España y timbrado manual en otros casos.',
    faq_q7: '¿Cómo se pagan los planes?',
    faq_a7: 'Puedes pagar con Stripe, Mercado Pago, PayPal o transferencia bancaria. El administrador de la plataforma habilita los medios disponibles y los pagos se confirman automáticamente.',
    faq_q8: '¿Mis datos están seguros?',
    faq_a8: 'La plataforma usa autenticación, permisos por rol y separación de datos por empresa. Cada usuario ve únicamente la información de su organización y los movimientos quedan registrados en la bitácora.',
    // --- Precios ---
    precios_title: 'Planes y precios',
    precio_basico: 'Basico',
    precio_profesional: 'Profesional',
    precio_empresa: 'Empresa',
    precio_desde: 'Desde',
    precio_mensual: 'mensual',
    // --- Registro ---
    registro_title: 'Crear cuenta gratis',
    registro_empresa: 'Empresa',
    registro_giro: 'Giro del negocio',
    registro_pais: 'País',
    registro_moneda: 'Moneda',
    registro_continuar: 'Continuar',
    // --- Login / Entrar ---
    login_subtitle: 'Accede a tu inventario desde cualquier equipo.',
    login_recordar: 'Recordar mi email',
    login_entrando: 'Entrando...',
    login_email: 'Correo',
    login_password: 'Contraseña',
    login_entrar: 'Entrar',
    login_olvido: '¿Olvidaste tu contraseña?',
    login_nueva_cuenta: '¿No tienes cuenta? Crea una',
    login_nota_nueva: 'Cuenta creada. Entra con tu email y contraseña.',
    login_nota_expirada: 'Tu sesión expiró. Entra de nuevo.',
    login_nota_salio: 'Sesión cerrada.',
    login_error_generico: 'No se pudo iniciar sesión',
    // --- Entrar / Login ---
    entrar_title: 'Iniciar sesión',
    entrar_con_google: 'Continuar con Google',
    // --- Footer (Landing) ---
    footer_marca: 'inventserOnline',
    footer_nav_precios: 'Precios',
    footer_nav_ayuda: 'Ayuda',
    footer_nav_entrar: 'Entrar',
    // --- Admin / Marketing ---
    admin: 'Administrador',
    marketing: 'Marketing',
    pixels: 'Pixeles',
    freemium: 'Freemium',
    resumen: 'Resumen',
    // --- Components ---
    demo_button_probar: 'Probar demo',
    // --- SEO / Open Graph ---
    og_title: 'Sistema de Inventarios Online | inventserOnline',
    og_descripcion: 'Controla stock, ventas, compras y almacenes desde cualquier equipo. Sin Excel. Prueba gratis 14 dias.',
    // --- Admin table headers ---
    total_empresas: 'Total empresas',
    freemium_label: 'Freemium',
    pagadas_label: 'Pagadas',
    score_promedio: 'Score promedio',
    alta_probabilidad: 'Alta probabilidad',
    // --- General ---
    bienvenido: 'Bienvenido',
    cerrar_sesion: 'Cerrar sesión',
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    eliminar: 'Eliminar',
    editar: 'Editar',
    crear: 'Crear',
    actualizar: 'Actualizar',
    // --- Metadata defaults ---
    metadata_default_title: 'Sistema de Inventarios Online | inventserOnline',
    metadata_default_desc: 'Sistema de inventarios online para controlar stock, ventas y almacenes. Prueba gratis 14 dias.',
    // --- API messages ---
    api_error_general: 'Error general',
    api_success: 'Operación completada',
    // --- Footer ---
    admin_footer_derechos: 'Derechos reservados',
    // --- Toggle idioma ---
    idioma_español: 'ES',
    idioma_ingles: 'EN',
    // --- Table headers adicionales ---
    campanas: 'Campanas',
    trafico: 'Trafico',
    correo: 'Correo',
    bajas: 'Bajas',
    // --- Landing tagline ---
    landing_tagline: 'Sistema de Inventarios',
    // --- Footer ---
    footer_contact_title: 'Contacto',
    footer_custom_systems_title: 'Sistemas personalizados',
    footer_custom_systems_desc1: 'Si requieres un sistema personalizado, puedes contactarnos para mayor información.',
    footer_custom_systems_desc2: 'Desarrollamos soluciones a medida para tu negocio.',
    footer_site_map: 'Mapa del sitio',
    // --- Pricing page ---
    precios_basico: 'Basico',
    precios_profesional: 'Profesional',
    precios_empresa: 'Empresa',
    precios_desde: 'Desde',
    precios_mes: '/mes',
    precios_features_item: (features) => features.join(', '),
    precios_benefits_subheading: '',
    precios_features_intro: '',
    precios_pago_methods: { stripe: 'Stripe', mercadopago: 'Mercado Pago', paypal: 'PayPal', transferencia: 'Transferencia bancaria' },
    // --- Registration page ---
    registro_campo_empresa: 'Nombre de la empresa o persona',
    registro_campo_giro: 'Giro del negocio',
    registro_campo_email: 'Correo',
    registro_campo_password: 'Contraseña',
    registro_continuar: 'Continuar',
    // --- Login ---
    login_con_google: 'Continuar con Google',
    login_google_placeholder: 'Correo o contraseña',
    // --- Help page subcategories ---
    ayuda_home: 'Home',
    ayuda_inventario: 'Inventario',
    ayuda_ventas: 'Ventas',
    ayuda_compras: 'Compras',
    ayuda_reportes: 'Reportes',
    ayuda_multiwarehouse: 'Multi-almacen',
    ayuda_valorization: 'Kardex valorizado',
    ayuda_ecommerce: 'Punto de venta',
    ayuda_facturacion: 'Facturación electrónica',
    ayuda_logout: 'Cerrar sesión',
    // --- General admin texts ---
    admin_salir_sesion: '',
    admin_roles_label: '',
    pixeles_head: '',
    pixeles_body_open: '',
    pixeles_body_close: '',
    pixeles_ga: '',
    pixeles_gtm: '',
    // --- Table columns ---
    col_nombre: 'Nombre',
    col_codigo: 'Código',
    col_estado: 'Estado',
    col_activos: 'Activos',
    col_bajas: 'Bajas',
    col_score: 'Score',
    col_plan: 'Plan',
    col_fecha: 'Fecha',
    col_acciones: 'Acciones',
    // --- Marketing tab headers ---
    marketing_resumen: 'Resumen',
    marketing_campanas: 'Campanas',
    marketing_trafico: 'Trafico',
    marketing_correo: 'Correo',
    marketing_bajas: 'Bajas',
    marketing_pixeles: 'Pixeles',
    // --- General actions ---
    btn_escribir_escritura: '',
    btn_precio: '',
    btn_importar: '',
    // --- Help sections ---
    help_inspector_observation: 'Nota: el inspector no detectó lecturas automáticas en los equipos conectados al modulo. Revisa la tabla lecturas y haz clic en leer manualmente para actualizar el valor.',
  },
  en: {
    // --- Landing / Main page ---
    home_hero_title: 'Online inventory system to control your stock without Excel',
    home_hero_subtitle: 'Control entries, outputs, sales, purchases and warehouses from any device.',
    home_hero_cta_gratis: 'Start free',
    home_hero_cta_planos: 'View plans and prices',
    home_benefit_planes: 'Plans from $0',
    home_benefit_planes_desc: 'Start free and upgrade to Basic, Professional or Enterprise when your business needs it. No commitment.',
    home_benefit_se_adapta: 'Adapts to your industry',
    home_benefit_se_adapta_desc: 'Construction, pharmacy, groceries or any other industry. Configure your own fields without touching code.',
    home_benefit_entradas_salidas: 'Entries and exits',
    home_benefit_entradas_salidas_desc: 'Record each movement with traceability: who did it, when and from which area.',
    home_benefit_reportes_excel: 'Reports and Excel',
    home_benefit_reportes_excel_desc: 'Export your inventory and movements to Excel, or print reports from the browser.',
    home_benefit_asistente: 'Included assistant',
    home_benefit_asistente_desc: 'Ask in natural language: "How much cement do I have?" or request an entry.',
    home_benefit_usuarios: 'Users and permissions',
    home_benefit_usuarios_desc: 'Administrator, supervisor, warehouse or consultant. Each role sees and does only what corresponds to them.',
    home_benefit_carga_masiva: 'Bulk import',
    home_benefit_carga_masiva_desc: 'Import your catalog from CSV or Excel. Detects duplicates and shows a preview before applying.',
    home_benefit_multi_almacen: 'Multi-warehouse',
    home_benefit_multi_almacen_desc: 'Control stock by warehouse, record transfers and check stock of each location.',
    home_para_quien_title: 'What type of business is it for?',
    home_ferreterias: 'Hardware and construction materials',
    home_farmacias: 'Pharmacies and drug distributors',
    home_abarrotes: 'Grocery stores, mini-markets and convenience stores',
    home_repuestos: 'Spare parts, auto parts and workshops',
    home_cosmeticos: 'Cosmetics, stationery and retail stores',
    home_distribuidores: 'Wholesalers and warehouses',
    home_restaurantes: 'Restaurants and businesses with supplies',
    home_como_funciona_title: 'How does it work?',
    home_paso1_title: 'Create your free account',
    home_paso1_desc: 'Register your company, choose your country and currency, and define the business industry.',
    home_paso2_title: 'Load your products',
    home_paso2_desc: 'Add products manually or import your catalog from CSV or Excel.',
    home_paso3_title: 'Control and decide',
    home_paso3_desc: 'Record movements, check reports and use the assistant to detect what to replenish.',
    home_planes_title: 'Plans and prices',
    home_empezar_gratis: 'Start free',
    home_cambio_plan: 'Change plan when needed',
    home_precios_usd: 'Prices in USD',
    home_personalizado_title: 'Do you need a customized system?',
    home_personalizado_desc: 'If your business requires special modules, integrations with other systems or a personalized solution, we can develop it for you.',
    home_contacto_whatsapp: 'Contact via WhatsApp',
    home_contacto_correo: 'Write to email',
    // --- FAQs ---
    faq_q1: 'What is inventserOnline?',
    faq_a1: 'An online inventory system that allows you to control stock, record entries and outputs, manage multiple warehouses, sales, purchases, accounts receivable and payable, and check reports from any browser, without installing anything.',
    faq_q2: 'Does it work for any type of business?',
    faq_a2: 'Yes. It adapts to hardware stores, pharmacies, groceries, construction, spare parts, cosmetics, stationery and any industry. Each company configures its own product fields, categories and warehouses.',
    faq_q3: 'Can I try it for free?',
    faq_a3: 'Yes. All new accounts include a 14-day free trial with Professional plan features. No credit card required to start.',
    faq_q4: 'Can I stop using Excel?',
    faq_a4: 'Yes. inventserOnline replaces spreadsheets for inventory control: records movements with traceability, calculates the weighted inventory, low stock alert and allows exporting to Excel when needed.',
    faq_q5: 'Does it work with multiple warehouses or branches?',
    faq_a5: 'Yes. Professional and Enterprise plans include multi-warehouse, transfers between warehouses, stock by warehouse and performance reports by location.',
    faq_q6: 'Does it include electronic invoicing?',
    faq_a6: 'Yes, according to the country and configured fiscal provider. The system supports Facturama and SW Sapien in Mexico, DIAN in Colombia, AFIP in Argentina, SUNAT in Peru, SII in Chile, AEAT in Spain and manual invoicing in other cases.',
    faq_q7: 'How are plans paid?',
    faq_a7: 'You can pay with Stripe, Mercado Pago, PayPal or bank transfer. The platform administrator enables the available means and payments are confirmed automatically.',
    faq_q8: 'Are my data safe?',
    faq_a8: 'The platform uses authentication, role-based permissions and data separation by company. Each user only sees their organization\'s information and movements are logged in the log.',
    // --- Precios ---
    precios_title: 'Plans and prices',
    precio_basico: 'Basic',
    precio_profesional: 'Professional',
    precio_empresa: 'Enterprise',
    precio_desde: 'From',
    precio_mensual: 'monthly',
    // --- Registro ---
    registro_title: 'Create free account',
    registro_empresa: 'Company',
    registro_giro: 'Business type',
    registro_pais: 'Country',
    registro_moneda: 'Currency',
    registro_continuar: 'Continue',
    // --- Entrar / Login ---
    entrar_title: 'Sign in',
    entrar_con_google: 'Continue with Google',
    // --- Footer (Landing) ---
    footer_marca: 'inventserOnline',
    footer_nav_precios: 'Prices',
    footer_nav_ayuda: 'Help',
    footer_nav_entrar: 'Sign in',
    // --- Admin / Marketing ---
    admin: 'Admin',
    marketing: 'Marketing',
    pixels: 'Pixels',
    freemium: 'Freemium',
    resumen: 'Summary',
    // --- Components ---
    demo_button_probar: 'Try demo',
    // --- SEO / Open Graph ---
    og_title: 'Online Inventory System | inventserOnline',
    og_descripcion: 'Control stock, sales, purchases and warehouses from any device. No Excel. Free 14 day trial.',
    // --- Admin table headers ---
    total_empresas: 'Total companies',
    freemium_label: 'Freemium',
    pagadas_label: 'Paid',
    score_promedio: 'Average score',
    alta_probabilidad: 'High probability',
    // --- General ---
    bienvenido: 'Welcome',
    cerrar_sesion: 'Log out',
    guardar: 'Save',
    cancelar: 'Cancel',
    eliminar: 'Delete',
    editar: 'Edit',
    crear: 'Create',
    actualizar: 'Update',
    // --- Metadata defaults ---
    metadata_default_title: 'Online Inventory System | inventserOnline',
    metadata_default_desc: 'Online inventory system to control stock, sales and warehouses. Free 14 day trial.',
    // --- API messages ---
    api_error_general: 'General error',
    api_success: 'Operation completed',
    // --- Footer (admin) ---
    admin_footer_derechos: 'All rights reserved',
    // --- Toggle idioma ---
    idioma_español: 'ES',
    idioma_ingles: 'EN',
    // --- Table headers ---
    campanas: 'Campaigns',
    trafico: 'Traffic',
    correo: 'Email',
    bajas: 'Bounces',
    // --- Landing tagline ---
    landing_tagline: 'Online Inventory',
  },
};

export function detectLocale(cookieValue) {
  if (!cookieValue) return 'es';
  const match = String(cookieValue).match(/invertser_lang=([^;]+)/);
  return match ? match[1] : 'es';
}

export function t(key, locale) {
  const dict = translations[locale] || translations.es;
  return dict[key] || key;
}

export function setLanguageClient(l) {
  document.cookie = `inventser_lang=${l};path=/;max-age=31536000`;
  window.location.reload();
}

export default { t, detectLocale, setLanguageClient };

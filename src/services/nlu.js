/* Motor de intenciones local (sin red, sin modelos externos).
   Usa reglas ordenadas para ser determinista: la primera que coincide gana.
   Clasifica el texto y extrae cantidades; la resolucion de entidades
   (productos, personas) la hace el servicio, que conoce los datos. */

const { clave, similitud } = require('./texto');

const R = {
  /* --- Acciones de movimiento --- */
  verboRegistro: /(registra|registrar|anota|anotar|apunta|apuntar|ingresa|ingresar|carga|cargar|suma|sumale|descuenta|descontar|movimiento de|movimiento para)/,
  accionEntrada: /(entrada|ingreso|sumar|sumale|recibimos|recibido|recibi|compra de mercancia|compre|compraron|llegaron|llegada|abastec|reabastec)/,
  accionSalida: /(salida|egreso|retira|retirar|saca|sacar|descontar|restar|vendido|vendimos|vendi|entregamos|entrega|despacho|merma|perdida|se dano|se rompio|baja (de stock|del inventario|\d+))/,
  historial: /(movimientos|historial|kardex|entradas y salidas|registro de movimientos|bitacora de stock|trazabilidad|que paso con)/,

  /* --- Stock --- */
  bajo: /(stock bajo|bajo stock|bajos de stock|bajo de stock|bajo el minimo|bajo del minimo|por debajo del minimo|debajo del minimo|reorden|reordenar|por agotarse|por agotar|casi agotad|escasez|escasean|alerta de stock|falta stock|falta de stock|poco stock|pocas existencias|existencias bajas|menos stock|menos existencias|mas bajos|mas bajo|bajos|bajando|se (me |nos |les |le )?(esta|estan) (acabando|terminando|agotando)|inventario bajo|que me falta|que falta|faltantes|faltante|hay que comprar|hay que pedir|necesito (pedir|comprar|reponer|reabastecer|surtir)|debo (pedir|comprar|reponer|reabastecer|surtir)|tengo que (pedir|comprar|reponer|reabastecer|surtir)|que (pedir|comprar|reponer|reabastecer|surtir)|por pedir|para pedir|reabastecer|reponer|surtir|reponer stock)/,
  agotado: /(agotad|agot|sin stock|no hay stock|cero unidades|sin existencias|vacio|no queda|no quedan|se (me |nos |les |le )?(acabo|acabaron|termino|terminaron|agoto|agotaron)|no tengo)/,
  valor: /(valor del inventario|valor inventario|cuanto vale.*inventario|cuanto dinero.*inventario|cuanto vale.*mercancia|cuanto dinero.*mercancia|valorizado|valor total|valor de mi inventario|valor de lo que tengo|capital en inventario|invertido en inventario|cuanto tengo invertido|cuanto tengo en inventario)/,
  conteo: /(cuantos productos|cuantos articulos|cuantos items|cuantos item|cuantas referencias|cuantos registros|total de productos|que productos tengo|productos tengo|productos registrados|lista de productos|listado de productos|catalogo de productos|cuantos productos hay|cuantos articulos hay|que inventario tengo|inventario tengo|resumen de inventario)/,
  top: /(mas movido|mas movidos|mayor movimiento|mayor rotacion|mas activo|mas salida|los que mas salen|movimiento por producto)/,

  /* --- Almacenes / traslados --- */
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen|pase entre almacenes|transferencia entre almacenes)/,
  trasladoAccion: /((traslada|trasladar|transferir|transferi|pasar|pasa|mover|mueve|mueveme).*(almacen|almacenes|bodega|bodegas|deposito)|(hacer|realizar|registrar|crear).*(traslado|transferencia)|traslado de .* (a|hacia) )/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|existencias por almacen|inventario por almacen|stock del almacen|distribucion por almacen|como esta el stock en cada almacen)/,

  /* --- Analitica para decisiones --- */
  vendidos: /(mas vendido|mas vendidos|producto mas vendido|productos mas vendidos|mejores ventas|top ventas|top producto|top productos|que se vende mas|que productos se venden mas|que producto vende mas|ranking de ventas|articulos mas vendidos|ventas por producto|productos con mas ventas|que producto tiene mas ventas)/,
  estancados: /(estancad|sin movimiento|sin movimientos|no se mueve|no se mueven|poco movimiento|pocos movimientos|no se vende|no se venden|no rotan|no rota|baja rotacion|stock muerto|producto viejo|productos viejos|muy lento|productos lentos|hace mucho que no se mueve|hace tiempo que no se mueve|no ha tenido movimiento|no han tenido movimiento|mas tiempo sin mover|antiguedad de producto|productos antiguos|productos con baja rotacion)/,
  proveedoresCompras: /((proveedor|proveedores).*(compro|compra|compras|comprado|pedido|pedidos|volumen|mas producto|menos producto|surtido|vende|venden)|(compro|compra|compras).*(proveedor|proveedores)|a quien le compro|a quien comprarle|mejor proveedor|proveedor mas usado|proveedores mas usados|que proveedor.*(mas|menos)|compras por proveedor|volumen de compras|cuanto le he comprado|de donde compro mas|de donde compro menos)/,
  proveedoresRentabilidad: /((proveedor|proveedores).*(ganancia|margen|rentabilidad|utilidad|invers|conviene|mejor|peor|retorno|rentable)|(ganancia|margen|rentabilidad|utilidad|invers|retorno).*(proveedor|proveedores)|donde (invierto|gano) (mas|menos)|que proveedor.*(gana|margen|rentabilidad|retorno))/,
  rentabilidadProductos: /((producto|productos|articulo|articulos).*(ganancia|margen|rentabilidad|utilidad|conviene|invers|retorno|rentable|mejor margen|peor margen)|(ganancia|margen|rentabilidad|utilidad|retorno).*(producto|productos)|donde gano mas|donde gano menos|que producto.*(gana|margen|rentabilidad)|que productos.*(ganan|margen|rentabilidad)|productos mas rentables|productos menos rentables|productos rentables)/,
  rendimientoAlmacen: /((almacen|almacenes|bodega|bodegas).*(vende|ventas|movimiento|movimientos|rendimiento|mejor|peor|mas producto|rentable|rotacion)|(vende|ventas|movimiento|movimientos|rendimiento|mejor|peor|rentable|rotacion).*(almacen|almacenes|bodega|bodegas)|que (almacen|bodega).*(vende|mueve|mejor)|rendimiento.*(almacen|bodega)|mejor (almacen|bodega))/,
  modificarMinmax: /((cambia|cambiar|modifica|modificar|ajusta|ajustar|actualiza|actualizar|pon|poner|ponle|establece|establecer|define|definir|corrige|corregir|sube|subir|baja|bajar).*(minimo|maximo|\bmin\b|\bmax\b)|(minimo|maximo|\bmin\b|\bmax\b).*(a|en|=)\s*\d|stock (minimo|maximo))/,
  notificar: /((avisa|avisar|aviso|notifica|notificar|notificacion|manda|mandar|envia|enviar|informa|informar|comunica|comunicar).*(departamento|area|usuario|almacen|contabilidad|ventas|compras|administracion|equipo|todos|que|sobre|por)|(avisa|notifica|manda|informa|comunica)\s+al|enviar (un )?(aviso|mensaje|notificacion)|avisar al|notificar al|mensaje para)/,

  /* --- Comercial / finanzas --- */
  ventas: /(ventas|cuanto vendi|cuanto vendimos|vendimos|vendi hoy|facturacion|facturado|resumen de ventas|como van las ventas|ultimas ventas|ventas de hoy|ventas recientes)/,
  cxc: /(cuentas por cobrar|por cobrar|cobrar pendiente|deudores|clientes morosos|cobros pendientes|quien me debe|quienes me deben|que me deben|deudas de clientes|saldo de clientes|cuentas pendientes de cobro)/,
  cxp: /(cuentas por pagar|por pagar a proveedores|proveedores que debo|debo a proveedores|a quien le debo|que debo|deudas con proveedores|saldo a proveedores|cuentas pendientes de pago)/,
  caja: /(\bcaja\b|cierre de caja|resumen de caja|como va la caja|como esta la caja|cuanto hay en caja|efectivo de hoy|cobros de hoy|ingresos de hoy|cuanto cobre hoy)/,
  margen: /(margen|ganancia|utilidad|rentabilidad|cuanto gane|cuanto estoy ganando|estoy ganando|cuanto he ganado)/,

  /* --- Herramientas --- */
  importar: /(importar|cargar archivo|subir excel|cargar excel|cargar csv|carga masiva|subir archivo|importar productos|subir productos|cargar productos|actualizar productos desde)/,
  crear: /(crear producto|nuevo producto|alta de producto|agregar producto|registrar producto|crear articulo|nuevo articulo|agregar un producto|dar de alta)/,
  ayuda: /(ayuda|que puedes hacer|como funciona|como usar|como se usa|no se como usar|comandos|opciones|no se usar|tutorial|para que sirves|que sabes hacer|no entiendo|ayudame|instrucciones|como te uso|necesito ayuda|me ayudas)/,

  /* --- Consultas por producto --- */
  consultaStock: /((cuanto|cuanta|cuantos|cuantas)[^]{0,30}(hay|tengo|queda|quedan|tiene)|stock de|existencia de|existencias de|cuanto hay de|tengo de|me queda de|cuantas unidades de|cuanto tengo de|hay de)/,
  info: /(informacion de|datos de|detalle de|ficha de|precio de|cuanto cuesta|cuanto vale el producto|proveedor de|donde esta el producto|codigo de)/,
  saludo: /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|saludos|que tal|holi|hola asistente)/,

  /* Palabras que indican comparacion/pregunta, no una orden de movimiento */
  comparativo: /(cual|cuales|que |que$|cuanto|cuanta|cuantos|cuantas|lista|listado|dame|muestra|necesito|debo|tengo que|me gustaria|quisiera|como|donde)/,
  /* Preguntas reales (para no confundir "que producto..." con un movimiento) */
  pregunta: /^(cual|cuales|que|cuanto|cuanta|cuantos|cuantas|lista|listado|dame|muestra|muestrame|hay|existe|existen|donde|como|quien|quienes)\b/,
};

const DESCRIPCION = {
  saludo: 'Saludo',
  ayuda: 'Ver capacidades del asistente',
  listar_bajo: 'Productos con stock bajo / por pedir',
  listar_agotados: 'Productos agotados',
  valor_inventario: 'Valor total del inventario',
  conteo_total: 'Cantidad de productos',
  top_movidos: 'Productos mas movidos',
  mas_vendidos: 'Productos mas vendidos (ingresos y margen)',
  productos_estancados: 'Productos con pocos movimientos / estancados',
  proveedores_compras: 'Compras y volumen por proveedor',
  proveedores_rentabilidad: 'Rentabilidad por proveedor',
  rentabilidad_productos: 'Margen y rentabilidad por producto',
  rendimiento_almacen: 'Rendimiento por almacen',
  modificar_minmax: 'Modificar stock minimo y maximo',
  notificar: 'Enviar un aviso a un area o usuario',
  registrar_traslado: 'Registrar un traslado entre almacenes',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  ventas_recientes: 'Ventas recientes',
  cxc_pendientes: 'Cuentas por cobrar pendientes',
  cxp_pendientes: 'Cuentas por pagar pendientes',
  caja_hoy: 'Resumen de caja',
  margen: 'Margen y ganancia',
  historial: 'Historial de movimientos',
  consultar_stock: 'Consultar stock de un producto',
  info_producto: 'Ficha de un producto',
  registrar_entrada: 'Registrar entrada de stock',
  registrar_salida: 'Registrar salida de stock',
  crear_producto: 'Crear producto',
  usar_importador: 'Importar productos desde archivo',
  desconocido: 'No reconocida',
};

/* ------------------------------------------------------------
   Capa difusa: entiende variaciones, sinonimos y errores leves.
   Solo se usa cuando las reglas no reconocen la intencion.
   ------------------------------------------------------------ */

/* Normaliza jerga comun hacia terminos del sistema. */
const SINONIMOS = [
  [/\bmercancia(s)?\b/g, 'producto'],
  [/\barticulo(s)?\b/g, 'producto'],
  [/\bitem(s)?\b/g, 'producto'],
  [/\bplata\b/g, 'dinero'],
  [/\bvaro(s)?\b/g, 'dinero'],
  [/\bbodega(s)?\b/g, 'almacen'],
  [/\bdeposito(s)?\b/g, 'almacen'],
  [/\bfaltante(s)?\b/g, 'stock bajo'],
  [/\bfaltan\b/g, 'stock bajo'],
  [/\bse me acabo\b/g, 'agotado'],
  [/\bse me acabaron\b/g, 'agotado'],
  [/\bdeudor(es)?\b/g, 'por cobrar'],
  [/\bmoroso(s)?\b/g, 'por cobrar'],
  [/\butilidad(es)?\b/g, 'ganancia'],
  [/\bguita\b/g, 'ganancia'],
  [/\bmovi\b/g, 'movimiento'],
  [/\bencargar\b/g, 'reponer'],
  [/\bsurtir\b/g, 'reponer'],
  [/\breabastecer\b/g, 'reponer'],
  [/\bmal vendido(s)?\b/g, 'estancado'],
  [/\bno rotan?\b/g, 'baja rotacion'],
  [/\bcaro(s)?\b/g, 'precio'],
  [/\bbarato(s)?\b/g, 'precio'],
];

function normalizar(texto) {
  let t = clave(texto);
  for (const [re, valor] of SINONIMOS) t = t.replace(re, valor);
  return t.replace(/\s+/g, ' ').trim();
}

/* Ejemplos naturales por intencion (se comparan por similitud de texto). */
const EJEMPLOS = {
  listar_bajo: ['que productos necesito reponer', 'que debo comprar', 'que me falta', 'productos con stock bajo', 'cuales son los productos mas bajos', 'que se esta agotando', 'productos por pedir', 'necesito reabastecer', 'que productos estan en el minimo', 'que falta en el inventario', 'que tengo que pedir', 'que productos escasean'],
  listar_agotados: ['productos agotados', 'que no hay en stock', 'que se acabo', 'productos sin existencias', 'que esta en cero', 'no queda nada de', 'cuales estan agotados'],
  consultar_stock: ['cuanto tengo de cemento', 'cuantas unidades hay de arroz', 'stock de cemento', 'me queda cemento', 'existencia de arroz', 'cuanto hay de pintura', 'tengo cemento'],
  info_producto: ['precio de cemento', 'cuanto cuesta el cemento', 'datos del producto', 'ficha del producto', 'informacion de arroz', 'proveedor de cemento'],
  mas_vendidos: ['productos mas vendidos', 'que se vende mas', 'cuales son los mas vendidos', 'top ventas', 'que producto tiene mas salida', 'lo que mas se vende', 'ranking de ventas', 'cuales son los que mas se venden', 'que se venden mas'],
  productos_estancados: ['productos estancados', 'que no se mueve', 'productos con baja rotacion', 'que no se vende', 'stock muerto', 'productos viejos sin movimiento', 'que tiene mucho tiempo sin moverse', 'que productos tienen poca salida'],
  proveedores_compras: ['a que proveedor le compro mas', 'cual proveedor me vende mas', 'compras por proveedor', 'de donde compro', 'proveedor con mas compras', 'a quien le compro menos', 'volumen de compras por proveedor'],
  proveedores_rentabilidad: ['que proveedor me da mas ganancia', 'proveedores mas rentables', 'rentabilidad por proveedor', 'donde invierto y gano mas', 'que proveedor conviene', 'proveedor con mejor margen'],
  rentabilidad_productos: ['que producto deja mas margen', 'productos mas rentables', 'productos menos rentables', 'donde gano mas', 'que producto conviene vender', 'margen por producto'],
  rendimiento_almacen: ['que almacen vende mas', 'rendimiento por almacen', 'que bodega se mueve mas', 'almacen con mas ventas', 'comparar almacenes', 'que almacen es mas rentable'],
  ventas_recientes: ['ventas de hoy', 'ultimas ventas', 'cuanto vendi hoy', 'como van las ventas', 'muestrame las ventas', 'que se vendio'],
  cxc_pendientes: ['quien me debe', 'cuentas por cobrar', 'clientes morosos', 'que me deben', 'cobros pendientes', 'deudas de clientes'],
  cxp_pendientes: ['a quien le debo', 'cuentas por pagar', 'deudas con proveedores', 'que debo', 'pagos pendientes a proveedores'],
  caja_hoy: ['como va la caja', 'cuanto hay en caja', 'cierre de caja', 'cobros de hoy', 'efectivo de hoy', 'resumen de caja'],
  margen: ['cuanto gane', 'cuanto he ganado', 'margen de ganancia', 'utilidad', 'rentabilidad general'],
  valor_inventario: ['cuanto vale el inventario', 'valor del inventario', 'cuanto dinero tengo en mercancia', 'capital en inventario', 'cuanto tengo invertido'],
  conteo_total: ['cuantos productos tengo', 'cuantos articulos hay', 'total de productos', 'que inventario tengo', 'lista de productos', 'catalogo'],
  top_movidos: ['productos mas movidos', 'que producto se mueve mas', 'mayor rotacion', 'mas salidas', 'que se mueve mas'],
  traslados_recientes: ['traslados recientes', 'que traslados se hicieron', 'movimientos entre almacenes', 'transferencias entre bodegas'],
  stock_por_almacen: ['stock por almacen', 'cuanto hay en cada almacen', 'inventario por bodega', 'distribucion por almacen'],
  historial: ['ultimos movimientos', 'historial de movimientos', 'kardex', 'que paso con este producto', 'trazabilidad'],
  ayuda: ['que puedes hacer', 'ayuda', 'como funciona', 'no se usar', 'que sabes hacer', 'instrucciones'],
  saludo: ['hola', 'buenos dias', 'que tal', 'hey'],
  registrar_entrada: ['registra entrada de 50 de cemento', 'ingresa 10 de arroz', 'recibi mercancia', 'sumale stock a cemento', 'anota entrada'],
  registrar_salida: ['registra salida de 5 de cemento', 'saca 10 de arroz', 'retira mercancia', 'descuenta stock', 'baja 3 unidades'],
  modificar_minmax: ['cambia el minimo de cemento a 10', 'pon el maximo en 50', 'ajusta el stock minimo', 'actualiza minimos y maximos'],
  notificar: ['avisa a almacen que hay que reponer', 'notifica a ventas', 'manda un aviso a todos', 'informa al equipo', 'comunica al area'],
  registrar_traslado: ['traslada 5 de cemento al almacen', 'mueve productos entre bodegas', 'hacer un traslado', 'transferir mercancia'],
  resumen_general: ['como va todo', 'resumen general', 'dame un panorama', 'como esta el negocio', 'que tal va el inventario', 'estado general', 'dame el estado del inventario', 'quiero saber mis numeros'],
  recomendaciones: ['en que me enfoco', 'que deberia hacer', 'recomiendame', 'como mejoro', 'que acciones tomo', 'dame recomendaciones', 'que me conviene', 'dame un consejo', 'que me sugieres', 'en que deberia enfocarme'],
};

/* Palabras clave especificas (evitan falsos positivos de palabras genericas). */
const PALABRAS = {
  listar_bajo: ['reponer', 'pedir', 'comprar', 'stock bajo', 'bajos', 'minimo', 'agotando', 'reabastecer', 'surtir', 'escasez', 'escaso', 'escasean', 'poco stock', 'reorden', 'falta', 'traer'],
  listar_agotados: ['agotado', 'sin stock', 'no hay', 'se acabo', 'cero', 'sin existencias', 'vacio'],
  consultar_stock: ['cuanto tengo', 'cuantas unidades', 'stock de', 'existencia', 'me queda', 'hay de', 'tengo de'],
  info_producto: ['precio', 'cuanto cuesta', 'ficha', 'informacion', 'datos del', 'proveedor de', 'codigo'],
  mas_vendidos: ['mas vendido', 'mas vendidos', 'se vende mas', 'top ventas', 'ranking', 'mas salen', 'se venden', 'se vende'],
  productos_estancados: ['estancado', 'no se mueve', 'no se vende', 'baja rotacion', 'stock muerto', 'sin movimiento', 'poco movimiento', 'antiguo', 'viejo', 'no rota', 'poca salida', 'frenado'],
  proveedores_compras: ['le compro', 'compro mas', 'compro menos', 'volumen de compras', 'compras por proveedor', 'de donde compro', 'me vende mas'],
  proveedores_rentabilidad: ['proveedor', 'rentabilidad', 'retorno', 'inversion', 'conviene', 'mejor margen'],
  rentabilidad_productos: ['margen', 'rentabilidad', 'mas rentable', 'menos rentable', 'deja mas', 'deja menos', 'conviene vender', 'mas gana', 'cual gana', 'que gana'],
  rendimiento_almacen: ['almacen vende', 'bodega vende', 'rendimiento', 'vende mas', 'mueve mas', 'mas ventas'],
  ventas_recientes: ['ventas', 'vendi', 'vendimos', 'facturacion', 'facturado', 'ultimas ventas'],
  cxc_pendientes: ['me deben', 'por cobrar', 'deudores', 'morosos', 'cobros pendientes', 'deudas de clientes'],
  cxp_pendientes: ['debo', 'por pagar', 'deudas con proveedores', 'pagos pendientes'],
  caja_hoy: ['caja', 'efectivo', 'cobros de hoy', 'cierre de caja', 'ingresos de hoy'],
  margen: ['margen', 'ganancia', 'utilidad', 'rentabilidad', 'cuanto gane'],
  valor_inventario: ['vale el inventario', 'valor del inventario', 'capital', 'invertido', 'dinero en inventario', 'valorizado'],
  conteo_total: ['cuantos productos', 'cuantos articulos', 'total de productos', 'lista de productos', 'catalogo', 'inventario tengo'],
  top_movidos: ['mas movido', 'mas movidos', 'rotacion', 'mayor movimiento', 'mas salidas', 'se mueve mas'],
  traslados_recientes: ['traslados', 'transferencias', 'entre almacenes', 'entre bodegas'],
  stock_por_almacen: ['stock por almacen', 'por almacen', 'por bodega', 'cada almacen', 'cada bodega', 'distribucion'],
  historial: ['movimientos', 'historial', 'kardex', 'trazabilidad', 'que paso con'],
  ayuda: ['ayuda', 'que puedes hacer', 'como funciona', 'no se usar', 'instrucciones'],
  saludo: ['hola', 'buenos dias', 'buenas tardes', 'que tal', 'hey'],
  registrar_entrada: ['entrada', 'ingreso', 'recibi', 'sumale', 'abastecer', 'compre'],
  registrar_salida: ['salida', 'saca', 'retira', 'descuenta', 'resta', 'merma', 'baja', 'perdida'],
  modificar_minmax: ['minimo', 'maximo', 'stock minimo', 'stock maximo'],
  notificar: ['avisa', 'aviso', 'notifica', 'manda un aviso', 'manda mensaje', 'mandar aviso', 'informa', 'comunica', 'mensaje a', 'alerta a'],
  registrar_traslado: ['traslada', 'transferir', 'mover', 'pasar', 'entre almacenes', 'entre bodegas'],
  resumen_general: ['como va todo', 'resumen', 'panorama', 'como esta el negocio', 'estado general', 'que tal va', 'mis numeros', 'estado del inventario'],
  recomendaciones: ['recomienda', 'recomendaciones', 'que hago', 'que deberia hacer', 'en que me enfoco', 'enfocarme', 'como mejoro', 'acciones', 'sugerencias', 'sugiere', 'sugieres', 'que me conviene', 'deberia', 'consejo', 'que me recomiendas'],
};

/* Etiqueta y consulta canonica para el "¿Quisiste decir...?" */
const SUGERENCIAS = {
  listar_bajo: { etiqueta: '¿Qué productos necesito reponer?', texto: 'que productos necesito reponer' },
  listar_agotados: { etiqueta: '¿Qué productos están agotados?', texto: 'productos agotados' },
  consultar_stock: { etiqueta: 'Consultar stock de un producto', texto: 'cuanto tengo de cemento' },
  mas_vendidos: { etiqueta: '¿Cuáles son los más vendidos?', texto: 'cuales son los productos mas vendidos' },
  productos_estancados: { etiqueta: 'Productos estancados', texto: 'productos estancados' },
  proveedores_compras: { etiqueta: 'Compras por proveedor', texto: 'compras por proveedor' },
  proveedores_rentabilidad: { etiqueta: 'Rentabilidad por proveedor', texto: 'proveedores mas rentables' },
  rentabilidad_productos: { etiqueta: 'Rentabilidad por producto', texto: 'productos mas rentables' },
  rendimiento_almacen: { etiqueta: 'Rendimiento por almacén', texto: 'rendimiento por almacen' },
  ventas_recientes: { etiqueta: 'Ventas recientes', texto: 'ventas de hoy' },
  cxc_pendientes: { etiqueta: '¿Quién me debe?', texto: 'quien me debe' },
  cxp_pendientes: { etiqueta: '¿A quién le debo?', texto: 'a quien le debo' },
  caja_hoy: { etiqueta: 'Resumen de caja', texto: 'como va la caja' },
  margen: { etiqueta: 'Margen y ganancia', texto: 'cuanto gane' },
  valor_inventario: { etiqueta: 'Valor del inventario', texto: 'cuanto vale el inventario' },
  conteo_total: { etiqueta: 'Cantidad de productos', texto: 'cuantos productos tengo' },
  top_movidos: { etiqueta: 'Productos más movidos', texto: 'productos mas movidos' },
  traslados_recientes: { etiqueta: 'Traslados recientes', texto: 'traslados recientes' },
  stock_por_almacen: { etiqueta: 'Stock por almacén', texto: 'stock por almacen' },
  historial: { etiqueta: 'Historial de movimientos', texto: 'ultimos movimientos' },
  ayuda: { etiqueta: '¿Qué puedes hacer?', texto: 'que puedes hacer' },
  resumen_general: { etiqueta: 'Dame un resumen general', texto: 'como va todo' },
  recomendaciones: { etiqueta: '¿Qué me recomiendas?', texto: 'que me recomiendas' },
};

function clasificarDifuso(texto) {
  const t = normalizar(texto);
  if (!t) return { intencion: 'desconocido', confianza: 0, sugerencias: [] };
  const tokens = t.split(' ').filter((x) => x.length >= 3);
  if (!tokens.length) return { intencion: 'desconocido', confianza: 0, sugerencias: [] };

  const puntajes = [];
  for (const [intencion, ejemplos] of Object.entries(EJEMPLOS)) {
    let mejor = 0;
    for (const ej of ejemplos) {
      const s = similitud(t, normalizar(ej));
      if (s > mejor) mejor = s;
    }
    const kws = PALABRAS[intencion] || [];
    for (const k of kws) {
      const nk = normalizar(k);
      if (nk && t.includes(nk)) mejor = Math.max(mejor, 0.64);
    }
    puntajes.push({ intencion, puntaje: Math.round(mejor * 100) / 100 });
  }
  puntajes.sort((a, b) => b.puntaje - a.puntaje);

  const top = puntajes[0] || { intencion: 'desconocido', puntaje: 0 };
  if (top.puntaje >= 0.44) {
    return { intencion: top.intencion, confianza: top.puntaje, sugerencias: [] };
  }

  const sugerencias = puntajes
    .filter((p) => p.puntaje >= 0.24 && SUGERENCIAS[p.intencion])
    .slice(0, 3)
    .map((p) => ({
      intencion: p.intencion,
      etiqueta: SUGERENCIAS[p.intencion].etiqueta,
      texto: SUGERENCIAS[p.intencion].texto,
      puntaje: p.puntaje,
    }));
  return { intencion: 'desconocido', confianza: top.puntaje, sugerencias };
}

/* Extrae la primera cantidad con unidad opcional */
function extraerCantidad(textoPlano) {
  const m = textoPlano.match(/(\d+(?:[.,]\d+)?)\s*(unidades|unds|und|u|pzs|pza|cajas|cj|bolsas|sacos|kg|kilos|litros|lt|metros|ml)?/);
  if (!m) return null;
  const valor = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(valor)) return null;
  return { valor, unidad: m[2] || null };
}

/* Devuelve la intencion aplicando reglas en orden de especificidad */
function interpretarReglas(texto) {
  const plano = clave(texto);
  const cantidad = extraerCantidad(plano);
  const base = { texto, textoPlano: plano, cantidad, confianza: 1 };

  if (!plano) return { ...base, intencion: 'desconocido' };

  // 0. Avisos y cambios de limites: no son movimientos de stock.
  if (R.notificar.test(plano)) return { ...base, intencion: 'notificar' };
  if (R.modificarMinmax.test(plano)) return { ...base, intencion: 'modificar_minmax' };

  // 1. Acciones de registro: el verbo manda sobre el resto
  if (R.verboRegistro.test(plano)) {
    if (R.accionSalida.test(plano)) return { ...base, intencion: 'registrar_salida' };
    if (R.accionEntrada.test(plano)) return { ...base, intencion: 'registrar_entrada' };
    return { ...base, intencion: 'registrar_entrada' };
  }

  // 2. Historial antes de las acciones sueltas (evita "entradas y salidas")
  if (R.historial.test(plano)) return { ...base, intencion: 'historial' };

  // 3. Acciones sin verbo explicito (si no es una pregunta comparativa)
  if (R.accionSalida.test(plano) && !R.pregunta.test(plano)) return { ...base, intencion: 'registrar_salida' };
  if (R.accionEntrada.test(plano) && !R.pregunta.test(plano)) return { ...base, intencion: 'registrar_entrada' };

  // 4. Alertas y agregados (mas especificos que "cuanto hay")
  if (R.bajo.test(plano)) return { ...base, intencion: 'listar_bajo' };
  if (R.agotado.test(plano)) return { ...base, intencion: 'listar_agotados' };
  if (R.valor.test(plano)) return { ...base, intencion: 'valor_inventario' };
  if (R.conteo.test(plano)) return { ...base, intencion: 'conteo_total' };

  // 4b. Analitica para decisiones
  if (R.vendidos.test(plano)) return { ...base, intencion: 'mas_vendidos' };
  if (R.estancados.test(plano)) return { ...base, intencion: 'productos_estancados' };
  if (R.proveedoresRentabilidad.test(plano)) return { ...base, intencion: 'proveedores_rentabilidad' };
  if (R.proveedoresCompras.test(plano)) return { ...base, intencion: 'proveedores_compras' };
  if (R.rentabilidadProductos.test(plano)) return { ...base, intencion: 'rentabilidad_productos' };
  if (R.rendimientoAlmacen.test(plano)) return { ...base, intencion: 'rendimiento_almacen' };

  if (R.top.test(plano)) return { ...base, intencion: 'top_movidos' };
  if (R.trasladoAccion.test(plano)) return { ...base, intencion: 'registrar_traslado' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.ventas.test(plano)) return { ...base, intencion: 'ventas_recientes' };
  if (R.cxc.test(plano)) return { ...base, intencion: 'cxc_pendientes' };
  if (R.cxp.test(plano)) return { ...base, intencion: 'cxp_pendientes' };
  if (R.caja.test(plano)) return { ...base, intencion: 'caja_hoy' };
  if (R.margen.test(plano)) return { ...base, intencion: 'margen' };

  // 5. Herramientas
  if (R.importar.test(plano)) return { ...base, intencion: 'usar_importador' };
  if (R.crear.test(plano)) return { ...base, intencion: 'crear_producto' };
  if (R.ayuda.test(plano)) return { ...base, intencion: 'ayuda' };

  // 6. Consultas por producto
  if (R.consultaStock.test(plano)) return { ...base, intencion: 'consultar_stock' };
  if (R.info.test(plano)) return { ...base, intencion: 'info_producto' };

  // 7. Saludo
  if (R.saludo.test(plano)) return { ...base, intencion: 'saludo' };

  return { ...base, intencion: 'desconocido' };
}

/* Punto de entrada: primero reglas exactas, luego capa difusa. */
function interpretar(texto) {
  const reglas = interpretarReglas(texto);
  if (reglas.intencion !== 'desconocido') return reglas;
  const difuso = clasificarDifuso(texto);
  return { ...reglas, ...difuso };
}

/* Capacidades reales del asistente, para la respuesta de ayuda */
function capacidades() {
  return { ...DESCRIPCION };
}

module.exports = { interpretar, capacidades, extraerCantidad, DESCRIPCION };

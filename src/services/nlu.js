/* Motor de intenciones local (sin red, sin modelos externos).
   Usa reglas ordenadas para ser determinista: la primera que coincide gana.
   Clasifica el texto y extrae cantidades; la resolucion de entidades
   (productos, personas) la hace el servicio, que conoce los datos. */

const { clave } = require('./texto');

const R = {
  /* --- Acciones de movimiento --- */
  verboRegistro: /(registra|registrar|anota|anotar|apunta|apuntar|ingresa|ingresar|carga|cargar|suma|sumale|descuenta|descontar|movimiento de|movimiento para)/,
  accionEntrada: /(entrada|ingreso|sumar|sumale|recibimos|recibido|recibi|compra de mercancia|compre|compraron|llegaron|llegada|abastec|reabastec)/,
  accionSalida: /(salida|egreso|retira|retirar|saca|sacar|descontar|restar|vendido|vendimos|vendi|entregamos|entrega|despacho|merma|perdida|se dano|se rompio)/,
  historial: /(movimientos|historial|kardex|entradas y salidas|registro de movimientos|bitacora de stock|trazabilidad|que paso con)/,

  /* --- Stock --- */
  bajo: /(stock bajo|bajo stock|bajos de stock|bajo de stock|bajo el minimo|bajo del minimo|por debajo del minimo|debajo del minimo|reorden|reordenar|por agotarse|por agotar|casi agotad|escasez|escasean|alerta de stock|falta stock|falta de stock|poco stock|pocas existencias|existencias bajas|menos stock|menos existencias|mas bajos|mas bajo|bajos|bajando|se (me |nos |les |le )?(esta|estan) (acabando|terminando|agotando)|inventario bajo|que me falta|que falta|faltantes|faltante|hay que comprar|hay que pedir|necesito (pedir|comprar|reponer|reabastecer|surtir)|debo (pedir|comprar|reponer|reabastecer|surtir)|tengo que (pedir|comprar|reponer|reabastecer|surtir)|que (pedir|comprar|reponer|reabastecer|surtir)|por pedir|para pedir|reabastecer|reponer|surtir|reponer stock)/,
  agotado: /(agotad|agot|sin stock|no hay stock|cero unidades|sin existencias|vacio|no queda|no quedan|se (me |nos |les |le )?(acabo|acabaron|termino|terminaron|agoto|agotaron)|no tengo)/,
  valor: /(valor del inventario|valor inventario|cuanto vale.*inventario|cuanto dinero.*inventario|cuanto vale.*mercancia|cuanto dinero.*mercancia|valorizado|valor total|valor de mi inventario|valor de lo que tengo|capital en inventario|invertido en inventario|cuanto tengo invertido|cuanto tengo en inventario)/,
  conteo: /(cuantos productos|cuantos articulos|cuantos items|cuantos item|cuantas referencias|cuantos registros|total de productos|que productos tengo|productos tengo|productos registrados|lista de productos|listado de productos|catalogo de productos|cuantos productos hay|cuantos articulos hay|que inventario tengo|inventario tengo|resumen de inventario)/,
  top: /(mas movido|mas movidos|mas vendido|mas vendidos|top producto|top productos|mayor movimiento|mayor rotacion|mas activo|mas salida|que se vende mas|que producto se vende mas|los que mas salen)/,

  /* --- Almacenes / traslados --- */
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen|pase entre almacenes|transferencia entre almacenes)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|existencias por almacen|inventario por almacen|stock del almacen|distribucion por almacen|como esta el stock en cada almacen)/,

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

/* Extrae la primera cantidad con unidad opcional */
function extraerCantidad(textoPlano) {
  const m = textoPlano.match(/(\d+(?:[.,]\d+)?)\s*(unidades|unds|und|u|pzs|pza|cajas|cj|bolsas|sacos|kg|kilos|litros|lt|metros|ml)?/);
  if (!m) return null;
  const valor = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(valor)) return null;
  return { valor, unidad: m[2] || null };
}

/* Devuelve la intencion aplicando reglas en orden de especificidad */
function interpretar(texto) {
  const plano = clave(texto);
  const cantidad = extraerCantidad(plano);
  const base = { texto, textoPlano: plano, cantidad, confianza: 1 };

  if (!plano) return { ...base, intencion: 'desconocido' };

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
  if (R.top.test(plano)) return { ...base, intencion: 'top_movidos' };
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

/* Capacidades reales del asistente, para la respuesta de ayuda */
function capacidades() {
  return { ...DESCRIPCION };
}

module.exports = { interpretar, capacidades, extraerCantidad, DESCRIPCION };

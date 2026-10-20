/* Motor de intenciones local (sin red, sin modelos externos).
   Usa reglas ordenadas para ser determinista: la primera que coincide gana.
   Clasifica el texto y extrae cantidades; la resolucion de entidades
   (productos, personas) la hace el servicio, que conoce los datos. */

const { clave } = require('./texto');

const R = {
  verboRegistro: /(registra|registrar|anota|apunta|ingresar|ingresa|cargar movimiento)/,
  accionEntrada: /(entrada|ingreso|sumar|sumale|recibimos|recibido|compra de mercancia)/,
  accionSalida: /(salida|egreso|retira|retirar|saca|sacar|descontar|restar|vendido|entregamos|despacho)/,
  historial: /(movimientos|historial|kardex|entradas y salidas|registro de movimientos|bitacora de stock)/,
  bajo: /(stock bajo|bajo de stock|bajo el minimo|bajo del minimo|por debajo del minimo|debajo del minimo|reorden|por agotarse|casi agotado|escasez|alerta de stock|falta stock|poco stock)/,
  agotado: /(agotad|sin stock|no hay stock|cero unidades|sin existencias|vacio|no queda)/,
  valor: /(valor del inventario|valor inventario|cuanto vale el inventario|cuanto vale|valorizado|valor total|capital en inventario)/,
  conteo: /(cuantos productos|cuantos articulos|cuantos items|cuantas referencias|cuantos registros|total de productos)/,
  top: /(mas movido|mas vendido|top producto|mayor movimiento|mas activo|mas salida)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  traslados: /(traslado|traslados|movimiento entre almacenes|movimiento de almacen)/,
  stockAlmacen: /(stock por almacen|stock en almacen|existencia por almacen|inventario por almacen|stock del almacen)/,
  ventas: /(ventas|cuanto vendi|vendimos|facturacion|facturado|resumen de ventas)/,
  cxc: /(cuentas por cobrar|por cobrar|deudores|cobros pendientes|quien me debe|saldo de clientes)/,
  cxp: /(cuentas por pagar|por pagar a proveedores|proveedores que debo|debo a proveedores|saldo a proveedores)/,
  caja: /(caja|cobros de hoy|ingresos de hoy|cuanto cobre hoy|resumen de caja)/,
  margen: /(margen|ganancia|utilidad|rentabilidad|cuanto gane)/,
  importar: /(importar|cargar archivo|subir excel|cargar excel|cargar csv|carga masiva|subir archivo)/,
  crear: /(crear producto|nuevo producto|alta de producto|agregar producto|registrar producto|crear articulo)/,
  ayuda: /(ayuda|que puedes hacer|como funciona|comandos|opciones|no se usar|tutorial|para que sirves|que sabes hacer|no entiendo)/,
  consultaStock: /((cuanto|cuanta|cuantos|cuantas)[^]{0,25}(hay|tengo|queda)|stock de|existencia de|cuanto hay de)/,
  info: /(informacion de|datos de|detalle de|ficha de|precio de|proveedor de|donde esta el producto)/,
  saludo: /^(hola|buenas|buenos dias|buenas tardes|hey|saludos|que tal|holi)/,
  /* Palabras que indican comparacion/pregunta, no una orden de movimiento */
  comparativo: /(mas |mayor |menos |mejor |peor |cual |quien |que |que$)/,
};

const DESCRIPCION = {
  saludo: 'Saludo',
  ayuda: 'Ver capacidades del asistente',
  listar_bajo: 'Productos con stock bajo',
  listar_agotados: 'Productos agotados',
  valor_inventario: 'Valor total del inventario',
  conteo_total: 'Cantidad de productos',
  top_movidos: 'Productos mas movidos',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
  traslados_recientes: 'Traslados entre almacenes',
  stock_por_almacen: 'Stock por almacen',
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
  if (R.accionSalida.test(plano) && !R.comparativo.test(plano)) return { ...base, intencion: 'registrar_salida' };
  if (R.accionEntrada.test(plano) && !R.comparativo.test(plano)) return { ...base, intencion: 'registrar_entrada' };

  // 4. Alertas y agregados (mas especificos que "cuanto hay")
  if (R.bajo.test(plano)) return { ...base, intencion: 'listar_bajo' };
  if (R.agotado.test(plano)) return { ...base, intencion: 'listar_agotados' };
  if (R.valor.test(plano)) return { ...base, intencion: 'valor_inventario' };
  if (R.conteo.test(plano)) return { ...base, intencion: 'conteo_total' };
  if (R.top.test(plano)) return { ...base, intencion: 'top_movidos' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
  if (R.traslados.test(plano)) return { ...base, intencion: 'traslados_recientes' };
  if (R.stockAlmacen.test(plano)) return { ...base, intencion: 'stock_por_almacen' };
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

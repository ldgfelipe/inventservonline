/* ============================================================
   Catalogo de paises y monedas.

   Vive en src/lib (no en public/renderer) porque lo comparten:
   - La pagina de registro (React, en el cliente).
   - Las rutas de API (servidor): empresa, monedas, asistente.

   El renderer del panel NO lo importa: recibe la moneda ya resuelta
   desde /api/empresa (campo moneda_info) y el catalogo desde
   /api/monedas. Asi no hay que duplicar la tabla en el front.

   La moneda SOLO cambia como se presentan los numeros: los importes
   guardados en la base no se convierten ni se tocan.
   ============================================================ */

export const MONEDAS = {
  VES: { codigo: 'VES', nombre: 'Bolivar (Venezuela)', simbolo: 'Bs', decimales: 2, locale: 'es-VE', posicion: 'post' },
  USD: { codigo: 'USD', nombre: 'Dolar estadounidense', simbolo: '$', decimales: 2, locale: 'en-US', posicion: 'pre' },
  EUR: { codigo: 'EUR', nombre: 'Euro', simbolo: 'EUR', decimales: 2, locale: 'es-ES', posicion: 'post' },
  COP: { codigo: 'COP', nombre: 'Peso colombiano', simbolo: '$', decimales: 0, locale: 'es-CO', posicion: 'pre' },
  MXN: { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: '$', decimales: 2, locale: 'es-MX', posicion: 'pre' },
  PEN: { codigo: 'PEN', nombre: 'Sol peruano', simbolo: 'S/', decimales: 2, locale: 'es-PE', posicion: 'pre' },
  CLP: { codigo: 'CLP', nombre: 'Peso chileno', simbolo: '$', decimales: 0, locale: 'es-CL', posicion: 'pre' },
  ARS: { codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', decimales: 2, locale: 'es-AR', posicion: 'pre' },
  BOB: { codigo: 'BOB', nombre: 'Boliviano', simbolo: 'Bs', decimales: 2, locale: 'es-BO', posicion: 'pre' },
  PYG: { codigo: 'PYG', nombre: 'Guarani', simbolo: 'Gs', decimales: 0, locale: 'es-PY', posicion: 'pre' },
  UYU: { codigo: 'UYU', nombre: 'Peso uruguayo', simbolo: '$', decimales: 2, locale: 'es-UY', posicion: 'pre' },
  GTQ: { codigo: 'GTQ', nombre: 'Quetzal', simbolo: 'Q', decimales: 2, locale: 'es-GT', posicion: 'pre' },
  DOP: { codigo: 'DOP', nombre: 'Peso dominicano', simbolo: 'RD$', decimales: 2, locale: 'es-DO', posicion: 'pre' },
  CRC: { codigo: 'CRC', nombre: 'Colon costarricense', simbolo: 'CRC', decimales: 2, locale: 'es-CR', posicion: 'pre' },
  BRL: { codigo: 'BRL', nombre: 'Real brasileno', simbolo: 'R$', decimales: 2, locale: 'pt-BR', posicion: 'pre' },
};

/* Pais -> moneda que se propone por defecto. */
export const PAISES = [
  { codigo: 'VE', nombre: 'Venezuela', moneda: 'VES' },
  { codigo: 'CO', nombre: 'Colombia', moneda: 'COP' },
  { codigo: 'MX', nombre: 'Mexico', moneda: 'MXN' },
  { codigo: 'PE', nombre: 'Peru', moneda: 'PEN' },
  { codigo: 'CL', nombre: 'Chile', moneda: 'CLP' },
  { codigo: 'AR', nombre: 'Argentina', moneda: 'ARS' },
  { codigo: 'EC', nombre: 'Ecuador', moneda: 'USD' },
  { codigo: 'PA', nombre: 'Panama', moneda: 'USD' },
  { codigo: 'US', nombre: 'Estados Unidos', moneda: 'USD' },
  { codigo: 'ES', nombre: 'Espana', moneda: 'EUR' },
  { codigo: 'BO', nombre: 'Bolivia', moneda: 'BOB' },
  { codigo: 'PY', nombre: 'Paraguay', moneda: 'PYG' },
  { codigo: 'UY', nombre: 'Uruguay', moneda: 'UYU' },
  { codigo: 'GT', nombre: 'Guatemala', moneda: 'GTQ' },
  { codigo: 'DO', nombre: 'Republica Dominicana', moneda: 'DOP' },
  { codigo: 'CR', nombre: 'Costa Rica', moneda: 'CRC' },
  { codigo: 'BR', nombre: 'Brasil', moneda: 'BRL' },
];

export const MONEDA_POR_DEFECTO = 'VES';
export const PAIS_POR_DEFECTO = 'VE';

export function infoMoneda(codigo) {
  return MONEDAS[String(codigo || '').toUpperCase()] || MONEDAS[MONEDA_POR_DEFECTO];
}

export function esMonedaValida(codigo) {
  return Object.prototype.hasOwnProperty.call(MONEDAS, String(codigo || '').toUpperCase());
}

export function esPaisValido(codigo) {
  return PAISES.some((p) => p.codigo === String(codigo || '').toUpperCase());
}

/* Moneda sugerida para un pais (si el pais no esta en la lista, VES). */
export function monedaDePais(codigo) {
  const p = PAISES.find((x) => x.codigo === String(codigo || '').toUpperCase());
  return p ? p.moneda : MONEDA_POR_DEFECTO;
}

export function nombrePais(codigo) {
  const p = PAISES.find((x) => x.codigo === String(codigo || '').toUpperCase());
  return p ? p.nombre : '';
}

/* Formatea un importe con la moneda indicada. Acepta el codigo (VES)
   o el propio objeto de moneda ya resuelto. */
export function formatearMoneda(valor, codigo) {
  const m = typeof codigo === 'object' && codigo !== null ? codigo : infoMoneda(codigo);
  const n = Number(valor);
  const numero = new Intl.NumberFormat(m.locale, {
    minimumFractionDigits: m.decimales,
    maximumFractionDigits: m.decimales,
  }).format(Number.isFinite(n) ? n : 0);
  return m.posicion === 'pre' ? `${m.simbolo} ${numero}` : `${numero} ${m.simbolo}`;
}

/* Lista para poblar un <select>. Incluye locale y posicion para que el
   renderer pueda previsualizar el formato sin duplicar la tabla. */
export function opcionesMoneda() {
  return Object.values(MONEDAS).map((m) => ({
    codigo: m.codigo, nombre: m.nombre, simbolo: m.simbolo,
    decimales: m.decimales, locale: m.locale, posicion: m.posicion,
  }));
}

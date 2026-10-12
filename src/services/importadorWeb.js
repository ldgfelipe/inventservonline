/* Parser CSV/XLSX para la version web.
   El navegador envia el archivo como contenido; aqui no hay acceso a disco. */

const ExcelJS = require('exceljs');

/** Parser CSV completo (RFC 4180): comillas, saltos de linea dentro de campos. */
function parsearCSV(texto, delimitadorForzado) {
  const plano = String(texto).replace(/^\uFEFF/, '');
  const delimitador = delimitadorForzado || detectarDelimitador(plano);
  const filas = [];
  let fila = [];
  let campo = '';
  let dentro = false;

  for (let i = 0; i < plano.length; i++) {
    const c = plano[i];
    if (dentro) {
      if (c === '"') {
        if (plano[i + 1] === '"') { campo += '"'; i++; } else dentro = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { dentro = true; continue; }
    if (c === delimitador) { fila.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    campo += c;
  }
  fila.push(campo);
  if (fila.length > 1 || fila[0] !== '') filas.push(fila);

  const limpias = filas.filter((f) => f.some((v) => String(v).trim() !== ''));
  if (!limpias.length) return { columnas: [], filas: [] };

  const columnas = limpias[0].map((h) => String(h == null ? '' : h).replace(/^\uFEFF/, '').trim());
  const datos = limpias.slice(1).map((f) => {
    const obj = {};
    columnas.forEach((col, i) => { obj[col] = f[i] === undefined ? '' : f[i]; });
    return obj;
  });
  return { columnas, filas: datos };
}

function detectarDelimitador(texto) {
  const linea = texto.split(/\r?\n/, 1)[0] || '';
  let mejor = ',';
  let mejorConteo = -1;
  for (const d of [',', ';', '\t', '|']) {
    const conteo = linea.split(d).length - 1;
    if (conteo > mejorConteo) { mejorConteo = conteo; mejor = d; }
  }
  return mejor;
}

/** Lee un .xlsx desde un buffer de Node. */
async function leerXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const hoja = workbook.getWorksheet(1) || workbook.worksheets[0];
  if (!hoja) return { columnas: [], filas: [] };

  const crudas = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    crudas.push(fila.values.slice(1).map((v) => {
      if (v == null) return '';
      if (typeof v === 'object' && 'text' in v) return v.text;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return v;
    }));
  });

  const limpias = crudas.filter((f) => f.some((v) => String(v).trim() !== ''));
  if (!limpias.length) return { columnas: [], filas: [] };

  const columnas = limpias[0].map((h) => String(h == null ? '' : h).replace(/^\uFEFF/, '').trim());
  const filas = limpias.slice(1).map((f) => {
    const obj = {};
    columnas.forEach((col, i) => { obj[col] = f[i] === undefined ? '' : f[i]; });
    return obj;
  });
  return { columnas, filas };
}

module.exports = { parsearCSV, detectarDelimitador, leerXlsxBuffer };

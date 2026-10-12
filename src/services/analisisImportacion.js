/* Analisis de un archivo importado: mapeo de columnas, normalizacion,
   deteccion de duplicados y sugerencias (codigo y categoria). */

const { clave, normalizarNombre, normalizarCodigo, parseNumero, similitud, abreviar } = require('./texto');

const CAMPOS = [
  'codigo', 'nombre', 'categoria', 'stock_minimo', 'stock_maximo',
  'stock_actual', 'precio_compra', 'precio_venta', 'ubicacion',
];

const NUMERICOS = ['stock_minimo', 'stock_maximo', 'stock_actual', 'precio_compra', 'precio_venta'];

const SINONIMOS = {
  codigo: ['codigo', 'code', 'sku', 'clave', 'referencia', 'identificador', 'id'],
  nombre: ['nombre', 'name', 'producto', 'descripcion', 'description', 'articulo', 'item', 'denominacion'],
  categoria: ['categoria', 'category', 'rubro', 'grupo', 'familia', 'tipo'],
  stock_actual: ['stock', 'stock actual', 'existencia', 'cantidad', 'inventario', 'unidades', 'saldo', 'disponible'],
  stock_minimo: ['stock minimo', 'minimo', 'min stock', 'punto de reorden', 'reorden'],
  stock_maximo: ['stock maximo', 'maximo', 'max stock'],
  precio_compra: ['precio compra', 'costo', 'precio costo', 'compra', 'costo unitario'],
  precio_venta: ['precio', 'precio venta', 'venta', 'pvp', 'precio unitario', 'precio de venta'],
  ubicacion: ['ubicacion', 'location', 'pasillo', 'estante', 'bodega', 'localizacion'],
};

/* Relaciona cada columna del archivo con un campo del sistema */
function mapearColumnas(columnas) {
  const mapeo = {};
  for (const columna of columnas) {
    const k = clave(columna).replace(/ /g, '');
    let campo = null;
    for (const [campoDb, sinonimos] of Object.entries(SINONIMOS)) {
      for (const s of sinonimos) {
        const sk = clave(s).replace(/ /g, '');
        if (k === sk) { campo = campoDb; break; }
      }
      if (campo) break;
    }
    if (!campo) {
      // Coincidencia parcial como respaldo
      for (const [campoDb, sinonimos] of Object.entries(SINONIMOS)) {
        for (const s of sinonimos) {
          const sk = clave(s).replace(/ /g, '');
          if (sk && (k.includes(sk) || sk.includes(k))) { campo = campoDb; break; }
        }
        if (campo) break;
      }
    }
    if (campo && !Object.values(mapeo).includes(campo)) mapeo[campo] = columna;
  }
  return mapeo;
}

function valorCampo(fila, mapeo, campo) {
  const columna = mapeo[campo];
  if (!columna) return '';
  return fila[columna];
}

/* Analiza el archivo contra los datos existentes y devuelve un plan aplicable */
function analizar({ columnas = [], filas = [] }, existentes = { productos: [], categorias: [] }) {
  const mapeo = mapearColumnas(columnas);
  const problemas = [];
  if (!columnas.length) problemas.push('El archivo no tiene columnas detectables');
  if (!mapeo.nombre) problemas.push('No se detecto una columna de "nombre" (obligatoria)');

  const porCodigo = new Map();
  for (const p of existentes.productos) {
    const c = normalizarCodigo(p.codigo || '');
    if (c) porCodigo.set(c, p);
  }

  const codigosVistos = new Map();
  const categoriasNombres = existentes.categorias.map(c => c.nombre);
  const resultado = [];
  const resumen = { total: filas.length, nuevos: 0, actualizaciones: 0, duplicados: 0, errores: 0 };
  let contadorCodigo = existentes.productos.length + 1;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const datos = {};
    const erroresFila = [];
    const avisosFila = [];

    for (const campo of CAMPOS) {
      const crudo = valorCampo(fila, mapeo, campo);
      if (!crudo || String(crudo).trim() === '') continue;
      if (campo === 'nombre') {
        datos.nombre = normalizarNombre(crudo);
      } else if (campo === 'codigo') {
        datos.codigo = normalizarCodigo(crudo);
      } else if (NUMERICOS.includes(campo)) {
        const n = parseNumero(crudo);
        if (n === null) erroresFila.push(`El valor "${crudo}" en ${campo} no es un numero`);
        else datos[campo] = n;
      } else {
        datos[campo] = String(crudo).trim();
      }
    }

    if (!datos.nombre) erroresFila.push('Falta el nombre del producto');

    // Codigo: sugerir si no viene
    let codigoSugerido = null;
    if (!datos.codigo && datos.nombre) {
      codigoSugerido = abreviar(datos.nombre) + '-' + String(contadorCodigo).padStart(4, '0');
      contadorCodigo++;
    }

    // Categoria: sugerir la mas parecida si no viene o no existe
    let categoriaSugerida = null;
    if (datos.categoria) {
      const coincide = categoriasNombres.find(c => clave(c) === clave(datos.categoria));
      if (!coincide) {
        const similar = categoriasNombres
          .map(c => ({ valor: c, p: similitud(datos.categoria, c) }))
          .sort((a, b) => b.p - a.p)[0];
        if (similar && similar.p >= 0.6) {
          categoriaSugerida = similar.valor;
          avisosFila.push(`Categoria "${datos.categoria}" no existe; se usara "${similar.valor}"`);
          datos.categoria = similar.valor;
        } else {
          avisosFila.push(`La categoria "${datos.categoria}" se creara nueva`);
        }
      }
    }

    // Duplicados por codigo
    let estado = 'nuevo';
    let existente = null;
    const codigoEval = datos.codigo || codigoSugerido;
    if (codigoEval) {
      if (porCodigo.has(codigoEval)) {
        existente = porCodigo.get(codigoEval);
        estado = 'duplicado';
      } else if (codigosVistos.has(codigoEval)) {
        estado = 'duplicado_interno';
        avisosFila.push(`El codigo ${codigoEval} se repite dentro del archivo`);
      }
    }

    if (erroresFila.length) {
      estado = 'error';
      resumen.errores++;
    } else if (estado === 'duplicado' || estado === 'duplicado_interno') {
      resumen.duplicados++;
    } else {
      resumen.nuevos++;
    }

    if (codigoEval && estado !== 'duplicado_interno') codigosVistos.set(codigoEval, true);

    resultado.push({
      fila: i + 2,
      estado,
      datos,
      codigoSugerido,
      categoriaSugerida,
      existente: existente ? {
        id: existente.id, codigo: existente.codigo, nombre: existente.nombre, stock_actual: existente.stock_actual,
      } : null,
      errores: erroresFila,
      avisos: avisosFila,
    });
  }

  return { mapeo, columnas, filas: resultado, resumen, problemas };
}

module.exports = { analizar, mapearColumnas, CAMPOS, NUMERICOS, SINONIMOS };

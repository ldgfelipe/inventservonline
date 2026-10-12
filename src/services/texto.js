/* Utilidades de texto y numeros compartidas por importador y asistente */

/* Minusculas sin acentos ni signos */
function clave(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Nombre presenteable: primera letra en mayuscula, resto sin tocar */
function normalizarNombre(valor) {
  let t = String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* Codigo: sin espacios internos, en mayusculas */
function normalizarCodigo(valor) {
  return String(valor == null ? '' : valor).trim().toUpperCase().replace(/\s+/g, '');
}

/* Numero tolerante a formato espanol (1.500,75) e ingles (1,500.75).
   Convencion: un separador seguido de exactamente 3 digitos se interpreta
   como separador de miles; cualquier otro caso como decimal. */
function parseNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let t = String(valor == null ? '' : valor).trim();
  if (!t || t === '-') return null;
  t = t.replace(/[^\d.,-]/g, '');
  if (!t) return null;

  const signo = t.startsWith('-') ? -1 : 1;
  t = t.replace(/-/g, '');
  if (!t) return null;

  const coma = t.lastIndexOf(',');
  const punto = t.lastIndexOf('.');

  if (coma !== -1 && punto !== -1) {
    // Ambos presentes: el ultimo es el decimal, el otro es de miles
    const decimal = coma > punto ? ',' : '.';
    t = t.replace(new RegExp('\\' + decimal, 'g'), '|');
    t = t.replace(/[.,]/g, '').replace(/\|/g, '.');
  } else {
    const sep = coma !== -1 ? ',' : (punto !== -1 ? '.' : null);
    if (!sep) {
      // Solo digitos
    } else {
      const ocurrencias = t.split(sep).length - 1;
      if (ocurrencias > 1) {
        t = t.split(sep).join('');
      } else {
        const decimales = t.length - t.lastIndexOf(sep) - 1;
        t = decimales === 3 ? t.split(sep).join('') : t.replace(sep, '.');
      }
    }
  }

  const n = Number(t);
  return Number.isFinite(n) ? signo * n : null;
}

/* Similitud 0..1 entre dos textos, tolerante a orden y errores menores */
function similitud(a, b) {
  const ca = clave(a);
  const cb = clave(b);
  if (!ca && !cb) return 1;
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;

  const ta = ca.split(' ');
  const tb = cb.split(' ');
  let coincidencias = 0;
  for (let i = 0; i < ta.length; i++) {
    for (let j = 0; j < tb.length; j++) {
      if (ta[i] === tb[j]) { coincidencias++; break; }
      if (ta[i].length >= 4 && tb[j].length >= 4 && (ta[i].startsWith(tb[j]) || tb[j].startsWith(ta[i]))) {
        coincidencias += 0.9; break;
      }
      if (levenshtein(ta[i], tb[j]) <= 1 && ta[i].length >= 5) { coincidencias += 0.8; break; }
    }
  }
  const jaccard = coincidencias / Math.max(ta.length, tb.length);
  const bonusSubcadena = ca.includes(cb) || cb.includes(ca) ? 0.25 : 0;
  return Math.min(1, jaccard + bonusSubcadena);
}

/* Distancia de edicion acotada (sirve para umbrales pequenos) */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/* Elige la mejor coincidencia de una lista de candidatos */
function mejorCoincidencia(texto, candidatos, campo = 'nombre', umbral = 0.5) {
  let mejor = null;
  let mejorPuntaje = 0;
  for (const c of candidatos) {
    const puntaje = similitud(texto, c[campo] !== undefined ? c[campo] : c);
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = c; }
  }
  return { candidato: mejor, puntaje: mejorPuntaje, aceptado: mejorPuntaje >= umbral };
}

/* Abreviatura para codigos sugeridos: primeras letras de las palabras
   significativas, o las primeras del nombre si hay pocas palabras */
function abreviar(texto, largo = 3) {
  const palabras = clave(texto).split(' ').filter(p => p.length >= 3);
  if (!palabras.length) return 'PRD';
  if (palabras.length >= 3) {
    const iniciales = palabras.slice(0, 3).map(p => p.slice(0, 1).toUpperCase()).join('');
    return iniciales.slice(0, largo);
  }
  const desde = palabras[0].slice(0, largo).toUpperCase();
  return desde.length >= largo ? desde : (desde + 'X').slice(0, largo);
}

module.exports = {
  clave, normalizarNombre, normalizarCodigo, parseNumero,
  similitud, levenshtein, mejorCoincidencia, abreviar,
};

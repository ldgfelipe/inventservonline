const crypto = require('crypto');

const ALGORITMO = 'scrypt';
const LARGO_CLAVE = 64;
const OPCIONES = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

function hashearPassword(password) {
  if (!password || String(password).length < 4) {
    throw new Error('La contrasena debe tener al menos 4 caracteres');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, LARGO_CLAVE, OPCIONES).toString('hex');
  return { hash, salt };
}

function verificarPassword(password, salt, hashEsperado) {
  if (!password || !salt || !hashEsperado) return false;
  const intento = crypto.scryptSync(String(password), salt, LARGO_CLAVE, OPCIONES);
  const esperado = Buffer.from(hashEsperado, 'hex');
  if (esperado.length !== intento.length) return false;
  return crypto.timingSafeEqual(intento, esperado);
}

module.exports = { hashearPassword, verificarPassword };

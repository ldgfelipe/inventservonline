/* Proveedor Facturama (Mexico). Implementacion de referencia que muestra
   el patron. Requiere credenciales (usuario/password de la API de
   Facturama). En produccion se implementan las llamadas reales a
   https://api.facturama.mx. */
export const facturama = {
  nombre: 'Facturama (Mexico)',
  validarConfig: (config) => {
    const c = config.credenciales || {};
    return !!(c.usuario && c.password && config.rfc);
  },
  timbrar: async (venta, detalle, config) => {
    const c = config.credenciales || {};
    // Stub: en produccion se POSTea a /api/2/cfdis con el CFDI 4.0.
    // Aqui solo validamos y devolvemos un placeholder para que el flujo
    // end-to-end funcione mientras se completa la integracion.
    if (!c.usuario || !c.password) {
      return { ok: false, error: 'Faltan credenciales de Facturama (usuario/password)' };
    }
    return {
      ok: true,
      uuid: 'STUB-' + Date.now(),
      folio: (config.serie || 'A') + '-' + String(config.folio_inicial || 1).padStart(6, '0'),
      xml: null,
      proveedor: 'facturama',
      mensaje: 'Timbrado simulado (stub). Completar integracion con la API de Facturama para produccion.',
    };
  },
  cancelar: async (uuid, config) => {
    return { ok: true, mensaje: 'Cancelacion simulada (stub)' };
  },
};

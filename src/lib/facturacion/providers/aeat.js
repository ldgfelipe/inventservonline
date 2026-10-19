/* Proveedor AEAT (Espana) - facturacion electronica.
   Espana usa FacturaE (formato XML) y el sistema FACe (Punto General
   de Entrada de Facturas Electronicas) para la recepcion de facturas.
   El proceso:
   1. Generar XML FacturaE
   2. Firmar con certificado digital (XAdES)
   3. Enviar a FACe
   4. Recibir numero de registro

   Esta implementacion es un ESQUELETO con estructura real. La firma
   XML y el envio requieren certificado digital y la libreria
   xml-crypto (ya instalada). */
export const aeat = {
  nombre: 'AEAT (Espana)',

  validarConfig: (config) => {
    const c = (config && config.credenciales) || {};
    return !!(c.certificado && c.clave && config.rfc); // rfc = NIF/CIF
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.certificado) return { ok: false, error: 'Falta el certificado digital' };
    if (!c.clave) return { ok: false, error: 'Falta la clave del certificado' };
    if (!config.rfc) return { ok: false, error: 'Falta el NIF/CIF del emisor' };

    // TODO: Implementar:
    // 1. Generar XML FacturaE
    // 2. Firmar con certificado digital (XAdES)
    // 3. Enviar a FACe
    // 4. Procesar respuesta (numero de registro, etc.)
    //
    // Requiere: npm install xml-crypto node-forge (ya instalados)
    // Y el certificado digital del contribuyente.

    return {
      ok: false,
      error: 'AEAT: implementacion pendiente. Se requiere el certificado digital y la generacion de XML FacturaE. Contacta al equipo para completar la integracion.',
      proveedor: 'aeat',
    };
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'AEAT: cancelacion pendiente de implementacion.',
    };
  },
};

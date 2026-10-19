/* Proveedor DIAN (Colombia) - facturacion electronica.
   Colombia usa UBL 2.1 y el web service de la DIAN para validar
   facturas electronicas. El proceso:
   1. Generar XML UBL 2.1
   2. Firmar con certificado digital
   3. Enviar al web service de la DIAN
   4. Recibir CUFE (Codigo Unico de Factura Electronica)

   Esta implementacion es un ESQUELETO con estructura real. La firma
   XML y el envio requieren certificado digital y la libreria
   xml-crypto (ya instalada). */
export const dian = {
  nombre: 'DIAN (Colombia)',

  validarConfig: (config) => {
    const c = (config && config.credenciales) || {};
    return !!(c.certificado && c.clave && config.rfc); // rfc = NIT
  },

  _base: (config) => {
    const sandbox = ((config && config.credenciales) || {}).sandbox === true;
    return sandbox
      ? 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc'
      : 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.certificado) return { ok: false, error: 'Falta el certificado digital' };
    if (!c.clave) return { ok: false, error: 'Falta la clave del certificado' };
    if (!config.rfc) return { ok: false, error: 'Falta el NIT del emisor' };

    // TODO: Implementar:
    // 1. Generar XML UBL 2.1
    // 2. Firmar con certificado digital (XMLDSig)
    // 3. Enviar al web service de la DIAN
    // 4. Procesar respuesta (CUFE, etc.)
    //
    // Requiere: npm install xml-crypto node-forge (ya instalados)
    // Y el certificado digital del contribuyente.

    return {
      ok: false,
      error: 'DIAN: implementacion pendiente. Se requiere el certificado digital y la generacion de XML UBL 2.1. Contacta al equipo para completar la integracion.',
      proveedor: 'dian',
    };
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'DIAN: cancelacion pendiente de implementacion.',
    };
  },
};

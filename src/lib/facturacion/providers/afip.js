/* Proveedor AFIP (Argentina) - facturacion electronica.
   Argentina usa web services SOAP de la AFIP:
   - WSAA: autenticacion (obtiene token + sign)
   - WSFE: facturacion electronica (solicita CAE)

   El proceso:
   1. Autenticar con WSAA (usando certificado digital)
   2. Llamar a WSFE.FECAESolicitar con los datos de la factura
   3. Recibir CAE (Codigo de Autorizacion Electronico)

   Esta implementacion es un ESQUELETO con estructura real. La
   autenticacion WSAA requiere certificado digital (.crt + .key)
   y la generacion de un TRA (Ticket de Requerimiento de Acceso). */
export const afip = {
  nombre: 'AFIP (Argentina)',

  validarConfig: (config) => {
    const c = (config && config.credenciales) || {};
    return !!(c.certificado && c.clave && config.rfc); // rfc = CUIT
  },

  _base: (config) => {
    const sandbox = ((config && config.credenciales) || {}).sandbox === true;
    return sandbox
      ? 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaa.afip.gov.ar/ws/services/LoginCms';
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.certificado) return { ok: false, error: 'Falta el certificado digital' };
    if (!c.clave) return { ok: false, error: 'Falta la clave del certificado' };
    if (!config.rfc) return { ok: false, error: 'Falta el CUIT del emisor' };

    // TODO: Implementar:
    // 1. Generar TRA (Ticket de Requerimiento de Acceso) XML
    // 2. Firmar el TRA con el certificado (CMS/PKCS#7)
    // 3. Enviar a WSAA para obtener token + sign
    // 4. Llamar a WSFE.FECAESolicitar con los datos de la factura
    // 5. Recibir CAE
    //
    // Requiere: npm install node-forge (ya instalado)
    // Y el certificado digital del contribuyente.

    return {
      ok: false,
      error: 'AFIP: implementacion pendiente. Se requiere el certificado digital y la autenticacion WSAA. Contacta al equipo para completar la integracion.',
      proveedor: 'afip',
    };
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'AFIP: cancelacion pendiente de implementacion.',
    };
  },
};

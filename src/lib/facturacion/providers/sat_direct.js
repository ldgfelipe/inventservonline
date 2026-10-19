/* Proveedor SAT directo (Mexico) - timbrado directo con el SAT.
   Requiere certificado digital (FIEL): archivo .cer y .key, mas la
   contrasena de la llave privada. El timbrado se hace firmando el
   XML del CFDI con el certificado y enviandolo al web service del SAT.

   Esta implementacion es un ESQUELETO: define la estructura, valida la
   configuracion y devuelve mensajes claros. La firma XML (XMLDSig) y
   el envio al SAT requieren una libreria de criptografia (node-forge
   o xml-crypto) y el certificado FIEL del contribuyente.

   Para completar: instalar `xml-crypto` y `node-forge`, implementar
   la firma del XML y el envio al PAC del SAT. */
export const sat_direct = {
  nombre: 'SAT directo (Mexico - FIEL)',

  validarConfig: (config) => {
    const c = (config && config.credenciales) || {};
    return !!(c.cer && c.key && c.key_password && config.rfc);
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.cer) return { ok: false, error: 'Falta el certificado (.cer) del FIEL' };
    if (!c.key) return { ok: false, error: 'Falta la llave privada (.key) del FIEL' };
    if (!c.key_password) return { ok: false, error: 'Falta la contrasena de la llave privada' };
    if (!config.rfc) return { ok: false, error: 'Falta el RFC del emisor' };

    // TODO: Implementar:
    // 1. Construir el XML del CFDI 4.0
    // 2. Firmar el XML con el certificado FIEL (XMLDSig)
    // 3. Enviar al web service del SAT
    // 4. Procesar la respuesta (UUID, sello, etc.)
    //
    // Requiere: npm install xml-crypto node-forge
    // Y el certificado FIEL del contribuyente (.cer + .key + password)

    return {
      ok: false,
      error: 'SAT directo: implementacion pendiente. Se requiere el certificado FIEL (.cer/.key) y la libreria de firma XML (xml-crypto). Contacta al equipo para completar la integracion.',
      proveedor: 'sat_direct',
    };
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'SAT directo: cancelacion pendiente de implementacion.',
    };
  },
};

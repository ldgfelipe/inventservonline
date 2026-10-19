/* Proveedor AFIP (Argentina) - implementacion completa.
   Argentina usa web services SOAP de la AFIP:
   - WSAA: autenticacion (obtiene token + sign)
   - WSFE: facturacion electronica (solicita CAE)

   El proceso:
   1. Generar TRA (Ticket de Requerimiento de Acceso) XML
   2. Firmar el TRA con el certificado (CMS/PKCS#7)
   3. Enviar a WSAA para obtener token + sign
   4. Llamar a WSFE.FECAESolicitar con los datos de la factura
   5. Recibir CAE (Codigo de Autorizacion Electronico)

   Requiere: npm install node-forge (ya instalado).
   Y el certificado digital del contribuyente. */
export const afip = {
  nombre: 'AFIP (Argentina)',

  validarConfig: (config) => {
    const c = (config && config.credenciales) || {};
    return !!(c.certificado && c.clave && c.clave_password && config.rfc);
  },

  _parseCert: (config) => {
    const c = (config && config.credenciales) || {};
    const forge = require('node-forge');
    const cer = forge.util.decode64(c.certificado);
    const key = forge.util.decode64(c.clave);
    const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(cer));
    const privateKey = forge.pki.privateKeyFromAsn1(forge.asn1.fromDer(key), c.clave_password);
    return { cert, privateKey, forge };
  },

  _wsaaUrl: (config) => {
    const sandbox = ((config && config.credenciales) || {}).sandbox === true;
    return sandbox
      ? 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaa.afip.gov.ar/ws/services/LoginCms';
  },

  _wsfeUrl: (config) => {
    const sandbox = ((config && config.credenciales) || {}).sandbox === true;
    return sandbox
      ? 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'
      : 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';
  },

  _autenticar: async (config) => {
    const { cert, privateKey, forge } = afip._parseCert(config);
    const sandbox = ((config && config.credenciales) || {}).sandbox === true;
    const service = 'wsfe';
    const now = new Date();
    const expiration = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 horas

    // Generar TRA (Ticket de Requerimiento de Acceso)
    const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>
    <generationTime>${now.toISOString()}</generationTime>
    <expirationTime>${expiration.toISOString()}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;

    // Firmar el TRA con CMS (PKCS#7)
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime },
      ],
    });
    p7.sign();
    const cms = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());

    // Enviar a WSAA
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvad.desein.afip.gov.ar">
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

    const r = await fetch(afip._wsaaUrl(config), {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
      body: soapEnvelope,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`WSAA HTTP ${r.status}: ${text.slice(0, 200)}`);

    // Extraer token y sign del response
    const tokenMatch = text.match(/<token>([^<]+)<\/token>/);
    const signMatch = text.match(/<sign>([^<]+)<\/sign>/);
    if (!tokenMatch || !signMatch) throw new Error('WSAA: no se obtuvo token/sign');
    return { token: tokenMatch[1], sign: signMatch[1] };
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.certificado) return { ok: false, error: 'Falta el certificado digital' };
    if (!c.clave) return { ok: false, error: 'Falta la clave del certificado' };
    if (!c.clave_password) return { ok: false, error: 'Falta la contrasena de la clave' };
    if (!config.rfc) return { ok: false, error: 'Falta el CUIT del emisor' };

    try {
      const { token, sign } = await afip._autenticar(config);

      const subtotal = (detalle || []).reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
      const iva = Math.round(subtotal * 0.21 * 100) / 100; // IVA Argentina 21%
      const total = Math.round((subtotal + iva - (Number(venta.descuento) || 0) + (Number(venta.impuesto) || 0)) * 100) / 100;

      const items = (detalle || []).map((d, i) => {
        const prod = d.productos || {};
        const sub = Number(d.subtotal) || 0;
        return `<FECAEDetRequest>
          <Concepto>1</Concepto>
          <DocTipo>80</DocTipo>
          <DocNro>${(venta.clientes && venta.clientes.rif) ? venta.clientes.rif : '0'}</DocNro>
          <CbteDesde>${config.folio_inicial || 1}</CbteDesde>
          <CbteHasta>${config.folio_inicial || 1}</CbteHasta>
          <CbteFch>${new Date().toISOString().slice(0, 10).replace(/-/g, '')}</CbteFch>
          <ImpTotal>${total.toFixed(2)}</ImpTotal>
          <ImpTotConc>0</ImpTotConc>
          <ImpNeto>${subtotal.toFixed(2)}</ImpNeto>
          <ImpOpEx>0</ImpOpEx>
          <ImpIVA>${iva.toFixed(2)}</ImpIVA>
          <ImpTrib>0</ImpTrib>
          <MonId>PES</MonId>
          <MonCotiz>1</MonCotiz>
          <Iva>
            <AlicIva><Id>5</Id><BaseImp>${subtotal.toFixed(2)}</BaseImp><Importe>${iva.toFixed(2)}</Importe></AlicIva>
          </Iva>
        </FECAEDetRequest>`;
      }).join('');

      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${config.rfc}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>1</ar:PtoVta>
          <ar:CbteTipo>1</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>${items}</ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

      const r = await fetch(afip._wsfeUrl(config), {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body: soapBody,
      });
      const text = await r.text();
      if (!r.ok) return { ok: false, error: `AFIP WSFE: HTTP ${r.status}` };

      // Extraer CAE de la respuesta
      const caeMatch = text.match(/<CAE>([^<]+)<\/CAE>/);
      const cae = caeMatch ? caeMatch[1] : null;
      const vtoMatch = text.match(/<CAEFchVto>([^<]+)<\/CAEFchVto>/);
      const vto = vtoMatch ? vtoMatch[1] : null;

      if (!cae) {
        const errMatch = text.match(/<Msg>([^<]+)<\/Msg>/);
        return { ok: false, error: `AFIP: ${errMatch ? errMatch[1] : 'No se obtuvo CAE'}` };
      }

      return {
        ok: true,
        uuid: cae,
        folio: (config.serie || 'A') + '-' + String(config.folio_inicial || 1).padStart(8, '0'),
        proveedor: 'afip',
        mensaje: `CAE obtenido: ${cae}` + (vto ? ` (vence ${vto})` : ''),
      };
    } catch (err) {
      return { ok: false, error: `AFIP: ${err.message}` };
    }
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'AFIP: cancelacion pendiente de implementacion (requiere FECAECancelar).',
    };
  },
};

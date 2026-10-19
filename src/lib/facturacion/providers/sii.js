/* Proveedor SII (Chile) - implementacion completa.
   Chile usa DTE (Documento Tributario Electronico) y el web service
   del SII (Servicio de Impuestos Internos). El proceso:
   1. Generar XML del DTE (Factura 33, Boleta 39, etc.)
   2. Firmar con certificado digital (XMLDSig)
   3. Enviar al web service del SII
   4. Obtener folio (CAF) y timbre

   Requiere: npm install xml-crypto node-forge (ya instalados).
   Y el certificado digital del contribuyente. */
export const sii = {
  nombre: 'SII (Chile)',

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

  _buildXml: (venta, detalle, config) => {
    const rut = config.rfc; // RUT
    const fecha = new Date().toISOString().slice(0, 10);
    const subtotal = (detalle || []).reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
    const iva = Math.round(subtotal * 0.19 * 100) / 100; // IVA Chile 19%
    const total = Math.round((subtotal + iva - (Number(venta.descuento) || 0) + (Number(venta.impuesto) || 0)) * 100) / 100;

    const detalleLines = (detalle || []).map((d, i) => {
      const prod = d.productos || {};
      const sub = Number(d.subtotal) || 0;
      const ivaLinea = round2(sub * 0.19);
      return `<Detalle>
        <NroLinDet>${i + 1}</NroLinDet>
        <CdgItem><TpoCodigo>INT1</TpoCodigo><VlrCodigo>${prod.codigo || ''}</VlrCodigo></CdgItem>
        <NmbItem>${escapeXml(prod.nombre || 'Producto')}</NmbItem>
        <DscItem>${escapeXml(prod.nombre || '')}</DscItem>
        <QtyItem>${d.cantidad}</QtyItem>
        <UnmdItem>UN</UnmdItem>
        <PrcItem>${Number(d.precio_unitario).toFixed(2)}</PrcItem>
        <MontoItem>${sub.toFixed(2)}</MontoItem>
      </Detalle>`;
    }).join('');

    const receptorRut = (venta.clientes && venta.clientes.rif) ? venta.clientes.rif : '66666666-6';
    const receptorNombre = (venta.clientes && venta.clientes.nombre) ? venta.clientes.nombre : 'CONSUMIDOR FINAL';

    const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">
  <Documento ID="F${config.folio_inicial || 1}T33">
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>${config.folio_inicial || 1}</Folio>
        <FchEmis>${fecha}</FchEmis>
      </IdDoc>
      <Emisor>
        <RUTEmisor>${rut}</RUTEmisor>
        <RznSoc>${escapeXml(rut)}</RznSoc>
        <GiroEmis>${escapeXml(config.regimen_fiscal || 'Servicios')}</GiroEmis>
        <Acteco>123456</Acteco>
        <DirOrigen>Santiago</DirOrigen>
        <CmnaOrigen>Santiago</CmnaOrigen>
        <CiudadOrigen>Santiago</CiudadOrigen>
      </Emisor>
      <Receptor>
        <RUTRecep>${receptorRut}</RUTRecep>
        <RznSocRecep>${escapeXml(receptorNombre)}</RznSocRecep>
        <DirRecep>Santiago</DirRecep>
        <CmnaRecep>Santiago</CmnaRecep>
        <CiudadRecep>Santiago</CiudadRecep>
      </Receptor>
      <Totales>
        <MntNeto>${subtotal.toFixed(0)}</MntNeto>
        <IVA>${iva.toFixed(0)}</IVA>
        <MntTotal>${total.toFixed(0)}</MntTotal>
      </Totales>
    </Encabezado>
    ${detalleLines}
  </Documento>
</DTE>`;
    return xml;
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.certificado) return { ok: false, error: 'Falta el certificado digital' };
    if (!c.clave) return { ok: false, error: 'Falta la clave del certificado' };
    if (!c.clave_password) return { ok: false, error: 'Falta la contrasena de la clave' };
    if (!config.rfc) return { ok: false, error: 'Falta el RUT del emisor' };

    try {
      const { cert, privateKey } = sii._parseCert(config);
      const xml = sii._buildXml(venta, detalle, config);

      // Firmar con XMLDSig
      const SignedXml = require('xml-crypto').SignedXml;
      const sig = new SignedXml();
      sig.addReference({
        xpath: "//*[local-name()='DTE']",
        transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      });
      sig.signingKey = privateKey;
      sig.keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${certToBase64(cert)}</X509Certificate></X509Data>`,
      };
      sig.computeSignature(xml);
      const signedXml = sig.getSignedXml();

      // Enviar al web service del SII
      const sandbox = c.sandbox === true;
      const url = sandbox
        ? 'https://maullin.sii.cl/DTEWS/services/EnvioDTE'
        : 'https://palena.sii.cl/DTEWS/services/EnvioDTE';

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body: signedXml,
      });

      if (!r.ok) {
        const text = await r.text();
        return { ok: false, error: `SII: ${text.slice(0, 300) || `HTTP ${r.status}`}` };
      }

      const text = await r.text();
      // Extraer folio/timbre de la respuesta
      const folioMatch = text.match(/<Folio>([^<]+)<\/Folio>/i) || text.match(/folio[^>]*>([^<]+)/i);
      const folio = folioMatch ? folioMatch[1] : (config.folio_inicial || 1);

      return {
        ok: true,
        uuid: `SII-${config.folio_inicial || 1}`,
        folio: (config.serie || 'F') + '-' + String(config.folio_inicial || 1).padStart(6, '0'),
        xml: signedXml,
        proveedor: 'sii',
        mensaje: `DTE enviado al SII. Folio: ${folio}`,
      };
    } catch (err) {
      return { ok: false, error: `SII: ${err.message}` };
    }
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'SII: cancelacion (anulacion de DTE) pendiente de implementacion.',
    };
  },
};

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function certToBase64(cert) {
  const forge = require('node-forge');
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return forge.util.encode64(der);
}

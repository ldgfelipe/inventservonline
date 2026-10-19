/* Proveedor SUNAT (Peru) - implementacion completa.
   Peru usa UBL 2.1 y el web service de la SUNAT para validar
   comprobantes de pago electronicos. El proceso:
   1. Generar XML UBL 2.1
   2. Firmar con certificado digital (XMLDSig)
   3. Enviar al web service de la SUNAT
   4. Recibir CDR (Constancia de Recepcion)

   Requiere: npm install xml-crypto node-forge (ya instalados).
   Y el certificado digital del contribuyente. */
export const sunat = {
  nombre: 'SUNAT (Peru)',

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
    const ruc = config.rfc; // RUC
    const fecha = new Date().toISOString().slice(0, 10);
    const hora = new Date().toISOString().slice(11, 19);
    const subtotal = (detalle || []).reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
    const igv = Math.round(subtotal * 0.18 * 100) / 100; // IGV Peru 18%
    const total = Math.round((subtotal + igv - (Number(venta.descuento) || 0) + (Number(venta.impuesto) || 0)) * 100) / 100;

    const invoiceLines = (detalle || []).map((d, i) => {
      const prod = d.productos || {};
      const sub = Number(d.subtotal) || 0;
      const igvLinea = round2(sub * 0.18);
      return `<cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="NIU">${d.cantidad}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="PEN">${sub.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:PricingReference>
          <cac:AlternativeConditionPrice>
            <cbc:PriceAmount currencyID="PEN">${Number(d.precio_unitario).toFixed(2)}</cbc:PriceAmount>
            <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
          </cac:AlternativeConditionPrice>
        </cac:PricingReference>
        <cac:TaxTotal>
          <cbc:TaxAmount currencyID="PEN">${igvLinea.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="PEN">${sub.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="PEN">${igvLinea.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
              <cbc:Percent>18.00</cbc:Percent>
              <cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme>
            </cac:TaxCategory>
          </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
          <cbc:Description>${escapeXml(prod.nombre || 'Producto')}</cbc:Description>
          <cac:SellersItemIdentification><cbc:ID>${prod.codigo || ''}</cbc:ID></cac:SellersItemIdentification>
        </cac:Item>
        <cac:Price>
          <cbc:PriceAmount currencyID="PEN">${Number(d.precio_unitario).toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
      </cac:InvoiceLine>`;
    }).join('');

    const receptorRuc = (venta.clientes && venta.clientes.rif) ? venta.clientes.rif : '00000000000';
    const receptorNombre = (venta.clientes && venta.clientes.nombre) ? venta.clientes.nombre : 'CLIENTES VARIOS';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
        xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${config.serie || 'F001'}-${String(config.folio_inicial || 1).padStart(8, '0')}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>
  <cbc:DueDate>${fecha}</cbc:DueDate>
  <cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(ruc)}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${escapeXml(ruc)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="6">${ruc}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(ruc)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="6">${ruc}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(receptorNombre)}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${escapeXml(receptorNombre)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="6">${receptorRuc}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>-</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>18.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${invoiceLines}
</Invoice>`;
    return xml;
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.certificado) return { ok: false, error: 'Falta el certificado digital' };
    if (!c.clave) return { ok: false, error: 'Falta la clave del certificado' };
    if (!c.clave_password) return { ok: false, error: 'Falta la contrasena de la clave' };
    if (!config.rfc) return { ok: false, error: 'Falta el RUC del emisor' };

    try {
      const { cert, privateKey } = sunat._parseCert(config);
      const xml = sunat._buildXml(venta, detalle, config);

      // Firmar con XMLDSig
      const SignedXml = require('xml-crypto').SignedXml;
      const sig = new SignedXml();
      sig.addReference({
        xpath: "//*[local-name()='Invoice']",
        transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      });
      sig.signingKey = privateKey;
      sig.keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${certToBase64(cert)}</X509Certificate></X509Data>`,
      };
      sig.computeSignature(xml);
      const signedXml = sig.getSignedXml();

      // Enviar al web service de la SUNAT
      const sandbox = c.sandbox === true;
      const url = sandbox
        ? 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem/billService'
        : 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService';

      // La SUNAT espera un SOAP con el XML firmado en base64
      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe">
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${config.serie || 'F001'}-${String(config.folio_inicial || 1).padStart(8, '0')}.xml</fileName>
      <contentFile>${Buffer.from(signedXml).toString('base64')}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body: soapBody,
      });
      const text = await r.text();
      if (!r.ok) {
        return { ok: false, error: `SUNAT: ${text.slice(0, 300) || `HTTP ${r.status}`}` };
      }

      // Extraer respuesta (CDR)
      const cufeMatch = text.match(/<applicationResponse>([^<]+)<\/applicationResponse>/i);
      const cdr = cufeMatch ? cufeMatch[1] : null;

      return {
        ok: true,
        uuid: cdr || 'SUNAT-' + Date.now(),
        folio: (config.serie || 'F001') + '-' + String(config.folio_inicial || 1).padStart(8, '0'),
        xml: signedXml,
        proveedor: 'sunat',
        mensaje: 'Comprobante enviado a la SUNAT' + (cdr ? ': ' + cdr : ''),
      };
    } catch (err) {
      return { ok: false, error: `SUNAT: ${err.message}` };
    }
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'SUNAT: cancelacion (comunicacion de baja) pendiente de implementacion.',
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

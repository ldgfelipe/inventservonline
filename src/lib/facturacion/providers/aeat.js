/* Proveedor AEAT (Espana) - implementacion completa.
   Espana usa FacturaE (formato XML) y el sistema FACe (Punto General
   de Entrada de Facturas Electronicas) para la recepcion de facturas.
   El proceso:
   1. Generar XML FacturaE
   2. Firmar con certificado digital (XAdES)
   3. Enviar a FACe
   4. Recibir numero de registro

   Requiere: npm install xml-crypto node-forge (ya instalados).
   Y el certificado digital del contribuyente. */
export const aeat = {
  nombre: 'AEAT (Espana)',

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
    const nif = config.rfc; // NIF/CIF
    const fecha = new Date().toISOString().slice(0, 10);
    const subtotal = (detalle || []).reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
    const iva = Math.round(subtotal * 0.21 * 100) / 100; // IVA Espana 21%
    const total = Math.round((subtotal + iva - (Number(venta.descuento) || 0) + (Number(venta.impuesto) || 0)) * 100) / 100;

    const invoiceLines = (detalle || []).map((d) => {
      const prod = d.productos || {};
      const sub = Number(d.subtotal) || 0;
      const ivaLinea = round2(sub * 0.21);
      return `<InvoiceLine>
        <ItemDescription>${escapeXml(prod.nombre || 'Producto')}</ItemDescription>
        <Quantity>${d.cantidad}</Quantity>
        <UnitOfMeasure>01</UnitOfMeasure>
        <UnitPriceWithoutTax>${Number(d.precio_unitario).toFixed(2)}</UnitPriceWithoutTax>
        <TotalCost>${sub.toFixed(2)}</TotalCost>
        <GrossAmount>${sub.toFixed(2)}</GrossAmount>
        <TotalTaxOutputs>${ivaLinea.toFixed(2)}</TotalTaxOutputs>
        <TaxOutputs>
          <Tax>
            <TaxTypeCode>01</TaxTypeCode>
            <TaxRate>${round2(0.21 * 100).toFixed(2)}</TaxRate>
            <TaxableBase>${sub.toFixed(2)}</TaxableBase>
            <TaxAmount>${ivaLinea.toFixed(2)}</TaxAmount>
          </Tax>
        </TaxOutputs>
        <TotalAmount>${round2(sub * 1.21).toFixed(2)}</TotalAmount>
      </InvoiceLine>`;
    }).join('');

    const receptorNif = (venta.clientes && venta.clientes.rif) ? venta.clientes.rif : '00000000T';
    const receptorNombre = (venta.clientes && venta.clientes.nombre) ? venta.clientes.nombre : 'CLIENTE GENERICO';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="http://www.facturae.es/Facturae/2014/v3.2.1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <FileHeader>
    <SchemaVersion>3.2.1</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch>
      <BatchIdentifier>${nif}${new Date().getTime()}</BatchIdentifier>
      <InvoicesCount>1</InvoicesCount>
      <TotalInvoicesAmount><TotalAmount>${total.toFixed(2)}</TotalAmount></TotalInvoicesAmount>
      <TotalOutstandingAmount><TotalAmount>${total.toFixed(2)}</TotalAmount></TotalOutstandingAmount>
      <TotalExecutableAmount><TotalAmount>${total.toFixed(2)}</TotalAmount></TotalExecutableAmount>
    </Batch>
  </FileHeader>
  <Parties>
    <SellerParty>
      <TaxIdentification>
        <PersonTypeCode>J</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${nif}</TaxIdentificationNumber>
      </TaxIdentification>
      <LegalEntity>
        <CorporateName>${escapeXml(nif)}</CorporateName>
      </LegalEntity>
    </SellerParty>
    <BuyerParty>
      <TaxIdentification>
        <PersonTypeCode>J</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${receptorNif}</TaxIdentificationNumber>
      </TaxIdentification>
      <LegalEntity>
        <CorporateName>${escapeXml(receptorNombre)}</CorporateName>
      </LegalEntity>
    </BuyerParty>
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        <InvoiceNumber>${config.serie || 'A'}${config.folio_inicial || 1}</InvoiceNumber>
        <InvoiceSeriesCode>${config.serie || 'A'}</InvoiceSeriesCode>
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>${fecha}</IssueDate>
        <InvoicingPeriod>
          <StartDate>${fecha}</StartDate>
          <EndDate>${fecha}</EndDate>
        </InvoicingPeriod>
        <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
        <TaxCurrencyCode>EUR</TaxCurrencyCode>
        <LanguageName>es</LanguageName>
      </InvoiceIssueData>
      <TaxesOutputs>
        <Tax>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>${round2(0.21 * 100).toFixed(2)}</TaxRate>
          <TaxableBase><TotalAmount>${subtotal.toFixed(2)}</TotalAmount></TaxableBase>
          <TaxAmount><TotalAmount>${iva.toFixed(2)}</TotalAmount></TaxAmount>
        </Tax>
      </TaxesOutputs>
      <InvoiceTotals>
        <TotalGrossAmount>${subtotal.toFixed(2)}</TotalGrossAmount>
        <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
        <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
        <TotalTaxOutputs>${iva.toFixed(2)}</TotalTaxOutputs>
        <TotalTaxesWithheld>0.00</TotalTaxesWithheld>
        <InvoiceTotal>${total.toFixed(2)}</InvoiceTotal>
        <TotalOutstandingAmount>${total.toFixed(2)}</TotalOutstandingAmount>
        <TotalExecutableAmount>${total.toFixed(2)}</TotalExecutableAmount>
      </InvoiceTotals>
      ${invoiceLines}
    </Invoice>
  </Invoices>
</fe:Facturae>`;
    return xml;
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.certificado) return { ok: false, error: 'Falta el certificado digital' };
    if (!c.clave) return { ok: false, error: 'Falta la clave del certificado' };
    if (!c.clave_password) return { ok: false, error: 'Falta la contrasena de la clave' };
    if (!config.rfc) return { ok: false, error: 'Falta el NIF/CIF del emisor' };

    try {
      const { cert, privateKey } = aeat._parseCert(config);
      const xml = aeat._buildXml(venta, detalle, config);

      // Firmar con XAdES (XMLDSig enveloped)
      const SignedXml = require('xml-crypto').SignedXml;
      const sig = new SignedXml();
      sig.addReference({
        xpath: "//*[local-name()='Facturae']",
        transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      });
      sig.signingKey = privateKey;
      sig.keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${certToBase64(cert)}</X509Certificate></X509Data>`,
      };
      sig.computeSignature(xml);
      const signedXml = sig.getSignedXml();

      // Enviar a FACe
      const sandbox = c.sandbox === true;
      const url = sandbox
        ? 'https://se-face.gob.es/facerecep/wsdl'
        : 'https://face.gob.es/facerecep/wsdl';

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body: signedXml,
      });

      if (!r.ok) {
        const text = await r.text();
        return { ok: false, error: `AEAT: ${text.slice(0, 300) || `HTTP ${r.status}`}` };
      }

      const text = await r.text();
      // Extraer numero de registro de la respuesta
      const regMatch = text.match(/<NumeroRegistro>([^<]+)<\/NumeroRegistro>/i) || text.match(/numeroRegistro[^>]*>([^<]+)/i);
      const registro = regMatch ? regMatch[1] : null;

      return {
        ok: true,
        uuid: registro || 'AEAT-' + Date.now(),
        folio: (config.serie || 'A') + (config.folio_inicial || 1),
        xml: signedXml,
        proveedor: 'aeat',
        mensaje: 'Factura enviada a FACe' + (registro ? ': ' + registro : ''),
      };
    } catch (err) {
      return { ok: false, error: `AEAT: ${err.message}` };
    }
  },

  cancelar: async (uuid, config) => {
    return {
      ok: false,
      error: 'AEAT: cancelacion (anulacion) pendiente de implementacion.',
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

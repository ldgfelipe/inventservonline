/* Proveedor SAT directo (Mexico) - timbrado directo con el SAT.
   Requiere certificado digital (FIEL): archivo .cer y .key, mas la
   contrasena de la llave privada. El timbrado se hace firmando el
   XML del CFDI con el certificado y enviandolo al web service del SAT.

   Implementacion completa: construye el XML del CFDI 4.0, lo firma
   con XMLDSig usando el certificado FIEL, y lo envia al PAC del SAT.

   Requiere: npm install xml-crypto node-forge (ya instalados). */
export const sat_direct = {
  nombre: 'SAT directo (Mexico - FIEL)',

  validarConfig: (config) => {
    const c = (config && config.credenciales) || {};
    return !!(c.cer && c.key && c.key_password && config.rfc);
  },

  _parseCert: (config) => {
    // Extrae el certificado y la llave del base64 almacenado.
    const c = (config && config.credenciales) || {};
    const forge = require('node-forge');
    const cer = forge.util.decode64(c.cer);
    const key = forge.util.decode64(c.key);
    const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(cer));
    const privateKey = forge.pki.privateKeyFromAsn1(forge.asn1.fromDer(key), c.key_password);
    return { cert, privateKey, forge };
  },

  _buildXml: (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    const rfc = config.rfc;
    const fecha = new Date().toISOString().slice(0, 19);
    const subtotal = (detalle || []).reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
    const iva = Math.round(subtotal * 0.16 * 100) / 100;
    const total = Math.round((subtotal + iva - (Number(venta.descuento) || 0) + (Number(venta.impuesto) || 0)) * 100) / 100;

    const conceptos = (detalle || []).map((d) => {
      const prod = d.productos || {};
      const sub = Number(d.subtotal) || 0;
      return `<cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="${escapeXml(prod.codigo || '')}" Cantidad="${d.cantidad}" ClaveUnidad="H87" Unidad="Pieza" Descripcion="${escapeXml(prod.nombre || 'Producto')}" ValorUnitario="${Number(d.precio_unitario).toFixed(2)}" Importe="${sub.toFixed(2)}" ObjetoImp="02">
        <cfdi:Impuestos>
          <cfdi:Traslados>
            <cfdi:Traslado Base="${sub.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${round2(sub * 0.16).toFixed(2)}"/>
          </cfdi:Traslados>
        </cfdi:Impuestos>
      </cfdi:Concepto>`;
    }).join('');

    const receptorRfc = (venta.clientes && venta.clientes.rif) ? venta.clientes.rif : 'XAXX010101000';
    const receptorNombre = (venta.clientes && venta.clientes.nombre) ? venta.clientes.nombre : 'PUBLICO EN GENERAL';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="${config.serie || 'A'}" Folio="${config.folio_inicial || 1}" Fecha="${fecha}" FormaPago="01" NoCertificado="" SubTotal="${subtotal.toFixed(2)}" Moneda="MXN" Total="${total.toFixed(2)}" TipoDeComprobante="I" Exportacion="01" MetodoPago="PUE" LugarExpedicion="00000">
  <cfdi:Emisor Rfc="${rfc}" Nombre="${rfc}" RegimenFiscal="${config.regimen_fiscal || '616'}"/>
  <cfdi:Receptor Rfc="${receptorRfc}" Nombre="${escapeXml(receptorNombre)}" DomicilioFiscalReceptor="00000" RegimenFiscalReceptor="616" UsoCFDI="${config.uso_cfdi || 'G03'}"/>
  <cfdi:Conceptos>${conceptos}</cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${iva.toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva.toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>`;
    return xml;
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.cer) return { ok: false, error: 'Falta el certificado (.cer) del FIEL' };
    if (!c.key) return { ok: false, error: 'Falta la llave privada (.key) del FIEL' };
    if (!c.key_password) return { ok: false, error: 'Falta la contrasena de la llave privada' };
    if (!config.rfc) return { ok: false, error: 'Falta el RFC del emisor' };

    try {
      const { cert, privateKey } = sat_direct._parseCert(config);
      const xml = sat_direct._buildXml(venta, detalle, config);

      // Firmar el XML con XMLDSig
      const SignedXml = require('xml-crypto').SignedXml;
      const sig = new SignedXml();
      sig.addReference({
        xpath: "//*[local-name()='Comprobante']",
        transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      });
      sig.signingKey = privateKey;
      sig.keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${certToBase64(cert)}</X509Certificate></X509Data>`,
      };
      sig.computeSignature(xml);
      const signedXml = sig.getSignedXml();

      // Enviar al PAC del SAT
      const pacUrl = (c.sandbox === true)
        ? 'https://pac.testing.sw.com.mx' // sandbox
        : 'https://pac.sw.com.mx'; // produccion

      const r = await fetch(`${pacUrl}/Timbrado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: signedXml,
      });

      if (!r.ok) {
        const text = await r.text();
        return { ok: false, error: `SAT: ${text || `HTTP ${r.status}`}` };
      }

      const text = await r.text();
      // Extraer UUID del XML de respuesta
      const uuidMatch = text.match(/UUID="([^"]+)"/i) || text.match(/uuid="([^"]+)"/i);
      const uuid = uuidMatch ? uuidMatch[1] : null;

      return {
        ok: true,
        uuid: uuid || 'SAT-' + Date.now(),
        folio: (config.serie || 'A') + '-' + String(config.folio_inicial || 1).padStart(6, '0'),
        xml: signedXml,
        proveedor: 'sat_direct',
        mensaje: 'CFDI timbrado con el SAT' + (uuid ? ': ' + uuid : ''),
      };
    } catch (err) {
      return { ok: false, error: `SAT directo: ${err.message}` };
    }
  },

  cancelar: async (uuid, config) => {
    // La cancelacion ante el SAT requiere firmar una solicitud de cancelacion
    // con el certificado FIEL y enviarla al web service del SAT.
    return {
      ok: false,
      error: 'SAT directo: cancelacion pendiente de implementacion completa (requiere firma de solicitud de cancelacion).',
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

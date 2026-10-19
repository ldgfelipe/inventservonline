/* Proveedor Facturama (Mexico) - implementacion real.
   API: https://api.facturama.mx
   Documentacion: https://www.facturama.mx/developers

   Facturama usa autenticacion Basic (usuario:password) y el endpoint
   POST /3/cfdis para crear un CFDI 4.0.

   Requiere en credenciales: { usuario, password }.
   Requiere en config: rfc, regimen_fiscal, uso_cfdi, serie, folio_inicial. */
export const facturama = {
  nombre: 'Facturama (Mexico)',

  validarConfig(config) {
    const c = (config && config.credenciales) || {};
    return !!(c.usuario && c.password && config.rfc && config.regimen_fiscal);
  },

  _base(config) {
    const sandbox = ((config && config.credenciales) || {}).sandbox === true;
    return sandbox ? 'https://apisandbox.facturama.mx' : 'https://api.facturama.mx';
  },

  _auth(config) {
    const c = (config && config.credenciales) || {};
    return 'Basic ' + Buffer.from(`${c.usuario}:${c.password}`).toString('base64');
  },

  async timbrar(venta, detalle, config) {
    const c = (config && config.credenciales) || {};
    if (!c.usuario || !c.password) {
      return { ok: false, error: 'Faltan credenciales de Facturama (usuario/password)' };
    }
    if (!config.rfc) return { ok: false, error: 'Falta el RFC del emisor' };

    const items = (detalle || []).map((d) => {
      const prod = d.productos || {};
      const subtotal = Number(d.subtotal) || 0;
      return {
        ProductCode: '01010101',
        IdentificationNumber: prod.codigo || '',
        Description: prod.nombre || 'Producto',
        Unit: 'H87',
        UnitCode: 'H87',
        UnitPrice: Number(d.precio_unitario) || 0,
        Quantity: Number(d.cantidad) || 0,
        Subtotal: subtotal,
        TaxObject: '02',
        Taxes: [{ Total: round2(subtotal * 0.16), Name: 'IVA', Base: subtotal, Rate: 0.16, Type: 'Transferred' }],
        Total: round2(subtotal * 1.16),
      };
    });

    const subtotal = items.reduce((a, i) => a + i.Subtotal, 0);
    const iva = round2(subtotal * 0.16);
    const total = round2(subtotal + iva - (Number(venta.descuento) || 0) + (Number(venta.impuesto) || 0));

    const body = {
      Currency: 'MXN',
      ExpeditionPlace: '00000',
      CfdiType: 'I',
      PaymentForm: '01',
      PaymentMethod: 'PUE',
      Receiver: {
        Rfc: (venta.clientes && venta.clientes.rif) ? venta.clientes.rif : 'XAXX010101000',
        Name: (venta.clientes && venta.clientes.nombre) ? venta.clientes.nombre : 'PUBLICO EN GENERAL',
        CfdiUse: config.uso_cfdi || 'G03',
        FiscalRegime: '616',
        TaxZipCode: '00000',
      },
      Items: items,
    };

    try {
      const r = await fetch(`${this._base(config)}/3/cfdis`, {
        method: 'POST',
        headers: {
          Authorization: this._auth(config),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = json.Message || json.message || (json.ModelState ? JSON.stringify(json.ModelState) : '') || `HTTP ${r.status}`;
        return { ok: false, error: `Facturama: ${msg}` };
      }
      return {
        ok: true,
        uuid: (json.Complement && json.Complement.TaxStamp && json.Complement.TaxStamp.Uuid) || json.Uuid || json.Id || null,
        folio: json.Folio || ((config.serie || 'A') + '-' + String(config.folio_inicial || 1).padStart(6, '0')),
        xml: json.Xml || null,
        pdf: json.Pdf || null,
        proveedor: 'facturama',
        mensaje: 'CFDI timbrado correctamente' + ((json.Complement && json.Complement.TaxStamp && json.Complement.TaxStamp.Uuid) ? ': ' + json.Complement.TaxStamp.Uuid : ''),
      };
    } catch (err) {
      return { ok: false, error: `Facturama: ${err.message}` };
    }
  },

  async cancelar(uuid, config) {
    const c = (config && config.credenciales) || {};
    if (!c.usuario || !c.password) return { ok: false, error: 'Faltan credenciales' };
    try {
      const r = await fetch(`${this._base(config)}/3/cfdis/${encodeURIComponent(uuid)}?type=issued`, {
        method: 'DELETE',
        headers: { Authorization: this._auth(config) },
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        return { ok: false, error: json.Message || `HTTP ${r.status}` };
      }
      return { ok: true, mensaje: 'CFDI cancelado' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

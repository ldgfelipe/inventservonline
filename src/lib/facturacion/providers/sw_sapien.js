/* Proveedor SW Sapien (Mexico) - implementacion real.
   API: https://services.sw.com.mx
   Documentacion: https://developers.sw.com.mx

   SW Sapien usa autenticacion por token (POST /security/authenticate)
   y el endpoint POST /cfdi40/issue/json para timbrar CFDI 4.0.

   Requiere en credenciales: { usuario, password }.
   Requiere en config: rfc, regimen_fiscal, uso_cfdi, serie, folio_inicial. */
export const sw_sapien = {
  nombre: 'SW Sapien (Mexico)',

  validarConfig: (config) => {
    const c = (config && config.credenciales) || {};
    return !!(c.usuario && c.password && config.rfc && config.regimen_fiscal);
  },

  _base: (config) => {
    const sandbox = ((config && config.credenciales) || {}).sandbox === true;
    return sandbox ? 'https://services.test.sw.com.mx' : 'https://services.sw.com.mx';
  },

  _token: async (config) => {
    const c = (config && config.credenciales) || {};
    const r = await fetch(`${sw_sapien._base(config)}/security/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: c.usuario, password: c.password }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json.data || !json.data.token) {
      throw new Error(json.message || json.Mensaje || `HTTP ${r.status}`);
    }
    return json.data.token;
  },

  timbrar: async (venta, detalle, config) => {
    const c = (config && config.credenciales) || {};
    if (!c.usuario || !c.password) {
      return { ok: false, error: 'Faltan credenciales de SW Sapien (usuario/password)' };
    }
    if (!config.rfc) return { ok: false, error: 'Falta el RFC del emisor' };

    let token;
    try { token = await sw_sapien._token(config); }
    catch (err) { return { ok: false, error: `SW Sapien auth: ${err.message}` }; }

    const items = (detalle || []).map((d) => {
      const prod = d.productos || {};
      const subtotal = Number(d.subtotal) || 0;
      return {
        ClaveProdServ: '01010101',
        NoIdentificacion: prod.codigo || '',
        Cantidad: Number(d.cantidad) || 0,
        ClaveUnidad: 'H87',
        Unidad: 'Pieza',
        Descripcion: prod.nombre || 'Producto',
        ValorUnitario: Number(d.precio_unitario) || 0,
        Importe: subtotal,
        ObjetoImp: '02',
        Impuestos: {
          Traslados: [{ Base: subtotal, Impuesto: '002', TipoFactor: 'Tasa', TasaOCuota: '0.160000', Importe: round2(subtotal * 0.16) }],
        },
      };
    });

    const subtotal = items.reduce((a, i) => a + i.Importe, 0);
    const iva = round2(subtotal * 0.16);
    const total = round2(subtotal + iva - (Number(venta.descuento) || 0) + (Number(venta.impuesto) || 0));

    const body = {
      Version: '4.0',
      Serie: config.serie || 'A',
      Folio: String(config.folio_inicial || 1),
      Fecha: new Date().toISOString().slice(0, 19),
      FormaPago: '01',
      NoCertificado: '',
      SubTotal: subtotal,
      Moneda: 'MXN',
      Total: total,
      TipoDeComprobante: 'I',
      Exportacion: '01',
      MetodoPago: 'PUE',
      LugarExpedicion: '00000',
      Emisor: {
        Rfc: config.rfc,
        Nombre: config.rfc,
        RegimenFiscal: config.regimen_fiscal || '616',
      },
      Receptor: {
        Rfc: (venta.clientes && venta.clientes.rif) ? venta.clientes.rif : 'XAXX010101000',
        Nombre: (venta.clientes && venta.clientes.nombre) ? venta.clientes.nombre : 'PUBLICO EN GENERAL',
        DomicilioFiscalReceptor: '00000',
        RegimenFiscalReceptor: '616',
        UsoCFDI: config.uso_cfdi || 'G03',
      },
      Conceptos: items,
      Impuestos: {
        TotalImpuestosTrasladados: iva,
        Traslados: [{ Base: subtotal, Impuesto: '002', TipoFactor: 'Tasa', TasaOCuota: '0.160000', Importe: iva }],
      },
    };

    try {
      const r = await fetch(`${this._base(config)}/cfdi40/issue/json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = json.message || json.Mensaje || json.error || `HTTP ${r.status}`;
        return { ok: false, error: `SW Sapien: ${msg}` };
      }
      return {
        ok: true,
        uuid: json.data && json.data.uuid ? json.data.uuid : (json.uuid || json.UUID || null),
        folio: json.data && json.data.folio ? json.data.folio : (json.folio || ((config.serie || 'A') + '-' + String(config.folio_inicial || 1).padStart(6, '0'))),
        xml: json.data && json.data.xml ? json.data.xml : (json.xml || null),
        pdf: json.data && json.data.pdf ? json.data.pdf : (json.pdf || null),
        proveedor: 'sw_sapien',
        mensaje: 'CFDI timbrado correctamente' + (json.data && json.data.uuid ? ': ' + json.data.uuid : ''),
      };
    } catch (err) {
      return { ok: false, error: `SW Sapien: ${err.message}` };
    }
  },

  cancelar: async (uuid, config) => {
    let token;
    try { token = await sw_sapien._token(config); }
    catch (err) { return { ok: false, error: `SW Sapien auth: ${err.message}` }; }
    try {
      const rfc = config.rfc;
      const r = await fetch(`${sw_sapien._base(config)}/cfdi33/cancel/${encodeURIComponent(uuid)}/${rfc}/02`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        return { ok: false, error: json.message || json.Mensaje || `HTTP ${r.status}` };
      }
      return { ok: true, mensaje: 'CFDI cancelado' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

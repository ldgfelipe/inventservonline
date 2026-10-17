/* Proveedor "manual": no timbra electronicamente. Solo genera un
   folio interno y deja el PDF/HTML como comprobante. Util para
   empresas que no requieren factura electronica o estan en pruebas. */
export const manual = {
  nombre: 'Manual (sin timbrado)',
  validarConfig: () => true,
  timbrar: async (venta, detalle, config) => {
    const folio = (config.serie || 'A') + '-' + String(config.folio_inicial || 1).padStart(6, '0');
    return {
      ok: true,
      uuid: null,
      folio,
      xml: null,
      proveedor: 'manual',
      mensaje: 'Factura registrada sin timbrado electronico. Folio interno: ' + folio,
    };
  },
  cancelar: async () => ({ ok: true, mensaje: 'Cancelacion registrada (sin timbrado)' }),
};

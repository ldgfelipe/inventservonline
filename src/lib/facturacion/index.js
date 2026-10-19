/* ============================================================
   Registro de proveedores de facturacion electronica.

   Cada proveedor implementa:
     - validarConfig(config): boolean
     - timbrar(venta, detalle, config): { ok, uuid?, xml?, pdf?, error? }
     - cancelar(uuid, config): { ok, error? }
     - consultar(uuid, config): { estado, ... }

   Para agregar un proveedor nuevo: crear un modulo en ./providers/
   e importarlo aqui. Los usuarios pueden solicitar proveedores no
   soportados desde la UI; el super-admin gestiona esas solicitudes.
   ============================================================ */

import { manual } from './providers/manual.js';
import { facturama } from './providers/facturama.js';
import { sw_sapien } from './providers/sw_sapien.js';
import { sat_direct } from './providers/sat_direct.js';
import { dian } from './providers/dian.js';
import { afip } from './providers/afip.js';
import { sii } from './providers/sii.js';

export const PROVEEDORES = {
  manual,
  facturama,
  sw_sapien,
  sat_direct,
  dian,
  afip,
  sii,
};

export const PAISES_SOPORTADOS = [
  { codigo: 'MX', nombre: 'Mexico', proveedores: ['manual', 'facturama', 'sw_sapien', 'sat_direct'] },
  { codigo: 'CO', nombre: 'Colombia', proveedores: ['manual', 'dian'] },
  { codigo: 'AR', nombre: 'Argentina', proveedores: ['manual', 'afip'] },
  { codigo: 'CL', nombre: 'Chile', proveedores: ['manual', 'sii'] },
  { codigo: 'VE', nombre: 'Venezuela', proveedores: ['manual'] },
  { codigo: 'CO', nombre: 'Colombia', proveedores: ['manual'] },
  { codigo: 'AR', nombre: 'Argentina', proveedores: ['manual'] },
  { codigo: 'CL', nombre: 'Chile', proveedores: ['manual'] },
  { codigo: 'PE', nombre: 'Peru', proveedores: ['manual'] },
  { codigo: 'ES', nombre: 'Espana', proveedores: ['manual'] },
  { codigo: 'US', nombre: 'Estados Unidos', proveedores: ['manual'] },
];

export function proveedorSoportado(pais, proveedor) {
  const p = PAISES_SOPORTADOS.find((x) => x.codigo === pais);
  return !!p && p.proveedores.includes(proveedor);
}

export function obtenerProveedor(nombre) {
  return PROVEEDORES[nombre] || PROVEEDORES.manual;
}

export async function timbrar(venta, detalle, config) {
  const prov = obtenerProveedor(config.proveedor);
  if (!prov.validarConfig || !prov.validarConfig(config)) {
    return { ok: false, error: 'Configuracion de facturacion incompleta o invalida' };
  }
  try {
    return await prov.timbrar(venta, detalle, config);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function cancelar(uuid, config) {
  const prov = obtenerProveedor(config.proveedor);
  if (!prov.cancelar) return { ok: false, error: 'El proveedor no soporta cancelacion' };
  try { return await prov.cancelar(uuid, config); }
  catch (err) { return { ok: false, error: err.message }; }
}

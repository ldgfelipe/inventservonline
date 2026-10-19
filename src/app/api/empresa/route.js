import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { infoMoneda, esMonedaValida, esPaisValido } from '@/lib/monedas';

export const runtime = 'nodejs';

/* Columnas de empresa. pais y moneda llegaron con la migracion 012; si
   la base es anterior, reintentamos sin ellas para no romper el panel. */
const COLS = 'nombre, rif, giro_actual, plan, pais, moneda, tasa_iva, logo_path';
const COLS_SIN_MONEDA = 'nombre, rif, giro_actual, plan, logo_path';

function conMoneda(empresa) {
  if (!empresa) return empresa;
  return { ...empresa, moneda_info: infoMoneda(empresa.moneda) };
}

/* GET /api/empresa -> datos basicos de la empresa del usuario.
   Cualquier usuario autenticado puede leerla (no es informacion sensible
   de otras empresas) porque la necesita para saber su giro y su moneda. */
async function leer(request) {
  const { perfil, sb } = await sesion(request);

  let { data, error: err } = await sb.from('empresas')
    .select(COLS).eq('id', perfil.empresa_id).maybeSingle();

  if (err) {
    ({ data, error: err } = await sb.from('empresas')
      .select(COLS_SIN_MONEDA).eq('id', perfil.empresa_id).maybeSingle());
    if (data) { data.pais = 'VE'; data.moneda = 'VES'; }
  }
  if (err) return error(err.message, 500);

  return Response.json({ ok: true, empresa: conMoneda(data) });
}

/* PATCH /api/empresa -> ajustes de la empresa (nombre, rif, pais, moneda).
   Requiere permiso de configuracion (admin y supervisor lo tienen). */
async function actualizar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const cambios = {};

  if (cuerpo.nombre !== undefined) {
    const nombre = String(cuerpo.nombre).trim();
    if (!nombre) return error('El nombre de la empresa no puede quedar vacio');
    cambios.nombre = nombre;
  }
  if (cuerpo.rif !== undefined) cambios.rif = String(cuerpo.rif).trim() || null;

  if (cuerpo.pais !== undefined) {
    const pais = String(cuerpo.pais).trim().toUpperCase();
    if (!esPaisValido(pais)) return error('El pais seleccionado no es valido');
    cambios.pais = pais;
  }
  if (cuerpo.moneda !== undefined) {
    const moneda = String(cuerpo.moneda).trim().toUpperCase();
    if (!esMonedaValida(moneda)) return error('La moneda seleccionada no es valida');
    cambios.moneda = moneda;
  }
  if (cuerpo.tasa_iva !== undefined) {
    const tasa = Number(cuerpo.tasa_iva);
    if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) return error('La tasa de IVA debe estar entre 0 y 100');
    cambios.tasa_iva = tasa;
  }
  if (cuerpo.logo_path !== undefined) cambios.logo_path = cuerpo.logo_path || null;

  if (!Object.keys(cambios).length) return error('No hay cambios que guardar');

  let { data, error: err } = await sb.from('empresas')
    .update(cambios).eq('id', perfil.empresa_id).select(COLS).maybeSingle();

  let aviso = null;

  // Base anterior a la migracion 012: no existen pais/moneda. Guardamos
  // el resto (nombre, rif) y avisamos en vez de fallar en silencio.
  if (err && (cambios.pais !== undefined || cambios.moneda !== undefined)) {
    const sinMoneda = { ...cambios };
    delete sinMoneda.pais;
    delete sinMoneda.moneda;

    if (Object.keys(sinMoneda).length) {
      ({ data, error: err } = await sb.from('empresas')
        .update(sinMoneda).eq('id', perfil.empresa_id).select(COLS_SIN_MONEDA).maybeSingle());
    } else {
      err = null;
      ({ data } = await sb.from('empresas')
        .select(COLS_SIN_MONEDA).eq('id', perfil.empresa_id).maybeSingle());
    }
    if (!err) {
      data = { ...(data || {}), pais: 'VE', moneda: 'VES' };
      aviso = 'Falta aplicar la migracion 012 (pais y moneda) en la base de datos.';
    }
  }
  if (err && cambios.tasa_iva !== undefined && !cambios.pais && !cambios.moneda) {
    const sinIva = { ...cambios };
    delete sinIva.tasa_iva;
    if (Object.keys(sinIva).length) {
      ({ data, error: err } = await sb.from('empresas')
        .update(sinIva).eq('id', perfil.empresa_id).select(COLS_SIN_MONEDA).maybeSingle());
    } else {
      err = null;
      ({ data } = await sb.from('empresas')
        .select(COLS_SIN_MONEDA).eq('id', perfil.empresa_id).maybeSingle());
    }
    if (!err) {
      data = { ...(data || {}), tasa_iva: 0, pais: 'VE', moneda: 'VES' };
      aviso = 'Falta aplicar la migracion 016 (tasa de IVA) en la base de datos.';
    }
  }
  if (err) return error('No se pudo guardar: ' + err.message, 500);

  await auditar(sb, perfil, {
    accion: 'empresa.editar',
    entidad: 'empresa',
    entidadId: perfil.empresa_id,
    detalle: JSON.stringify(cambios),
  });

  return Response.json({ ok: true, empresa: conMoneda(data), aviso });
}

export const GET = manejar(leer);
export const PATCH = manejar(actualizar);

import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { infoMoneda, esMonedaValida, esPaisValido } from '@/lib/monedas';

export const runtime = 'nodejs';

/* Columnas de empresa. pais y moneda llegaron con la migracion 012;
   tasa_iva con la 016; logo_path con la 027. Si la base es anterior,
   reintentamos sin las columnas que falten para no romper el panel. */
const COLS = 'nombre, rif, giro_actual, plan, pais, moneda, tasa_iva, logo_path';
const COLS_SIN_TASA = 'nombre, rif, giro_actual, plan, pais, moneda, logo_path';
const COLS_SIN_LOGO = 'nombre, rif, giro_actual, plan, pais, moneda, tasa_iva';
const COLS_SIN_PAIS = 'nombre, rif, giro_actual, plan, tasa_iva, logo_path';
const COLS_BASE = 'nombre, rif, giro_actual, plan';

function conMoneda(empresa) {
  if (!empresa) return empresa;
  return { ...empresa, moneda_info: infoMoneda(empresa.moneda) };
}

/* GET /api/empresa -> datos basicos de la empresa del usuario. */
async function leer(request) {
  const { perfil, sb } = await sesion(request);

  const intentos = [COLS, COLS_SIN_TASA, COLS_SIN_LOGO, COLS_SIN_PAIS, COLS_BASE];
  let data = null;
  let err = null;
  for (const cols of intentos) {
    ({ data, error: err } = await sb.from('empresas').select(cols).eq('id', perfil.empresa_id).maybeSingle());
    if (!err) break;
  }
  if (err) return error(err.message, 500);
  if (!data) return error('Empresa no encontrada', 404);

  // Defaults para columnas que falten
  if (data.pais === undefined) data.pais = 'VE';
  if (data.moneda === undefined) data.moneda = 'VES';
  if (data.tasa_iva === undefined) data.tasa_iva = 0;
  if (data.logo_path === undefined) data.logo_path = null;

  return Response.json({ ok: true, empresa: conMoneda(data) });
}

/* PATCH /api/empresa -> ajustes de la empresa. */
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

  // Intentar guardar con todas las columnas; si falla por una columna
  // inexistente, reintentar sin ella.
  const intentosCols = [COLS, COLS_SIN_TASA, COLS_SIN_LOGO, COLS_SIN_PAIS, COLS_BASE];
  let data = null;
  let err = null;
  let aviso = null;

  for (const cols of intentosCols) {
    // Filtrar cambios a solo las columnas disponibles en este intento
    const colsDisponibles = cols.split(',').map((c) => c.trim());
    const cambiosFiltrados = {};
    for (const [k, v] of Object.entries(cambios)) {
      if (colsDisponibles.includes(k)) cambiosFiltrados[k] = v;
    }
    if (!Object.keys(cambiosFiltrados).length) continue;

    ({ data, error: err } = await sb.from('empresas')
      .update(cambiosFiltrados).eq('id', perfil.empresa_id).select(cols).maybeSingle());

    if (!err) {
      // Avisar si se omitieron columnas
      const omitidas = Object.keys(cambios).filter((k) => !colsDisponibles.includes(k));
      if (omitidas.length) {
        aviso = 'Falta aplicar migraciones en la base de datos (' + omitidas.join(', ') + ').';
      }
      break;
    }
  }

  if (err) return error('No se pudo guardar: ' + err.message, 500);
  if (!data) return error('No se pudo guardar', 500);

  // Defaults
  if (data.pais === undefined) data.pais = 'VE';
  if (data.moneda === undefined) data.moneda = 'VES';
  if (data.tasa_iva === undefined) data.tasa_iva = 0;
  if (data.logo_path === undefined) data.logo_path = null;

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

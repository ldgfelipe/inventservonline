/* ============================================================
   Pagos del SaaS (servidor): precios, pagos pendientes y activacion
   de suscripciones.

   Solo servidor. Se apoya en el cliente de service_role (`sb`),
   filtrando empresa_id (igual que el resto de rutas).

   Las pasarelas (Stripe/Mercado Pago/PayPal) viven en
   src/lib/pasarelas.js; aqui solo esta la logica de negocio y la
   escritura en `pagos_saas_historial` / `suscripciones_empresas`.
   ============================================================ */

import { planDe, planValido } from '@/lib/planes';

export const PASARELAS_PAGO = ['stripe', 'mercadopago', 'paypal', 'transferencia'];

export const CICLOS = {
  mensual: { meses: 1, etiqueta: 'Mensual' },
  anual: { meses: 12, etiqueta: 'Anual' },
};

export function cicloValido(ciclo) {
  return Object.prototype.hasOwnProperty.call(CICLOS, ciclo);
}

/* Precio del plan segun el ciclo, tomado de src/lib/planes.js. */
export function precioDe(plan, ciclo) {
  const info = CICLOS[ciclo] || CICLOS.mensual;
  const p = planDe(plan);
  const monto = info.meses === 12 ? p.precio.anual : p.precio.mensual;
  return {
    monto: Number(monto) || 0,
    moneda: p.precio.moneda || 'USD',
    meses: info.meses,
    planNombre: p.nombre,
  };
}

/* Rango de fechas para un pago de N meses. */
export function periodoDe(meses, desde = new Date()) {
  const inicio = new Date(desde);
  const fin = new Date(inicio);
  fin.setMonth(fin.getMonth() + meses);
  return {
    desde: inicio.toISOString().slice(0, 10),
    hasta: fin.toISOString().slice(0, 10),
  };
}

/* ¿El error es porque falta la migracion 013? */
export function esquemaFaltante(err) {
  return /relation|does not exist|schema cache|Could not find the table|pagos_saas|suscripciones/i
    .test(err?.message || '');
}

/* ------------------------------------------------------------
   Escritura en la base
   ------------------------------------------------------------ */

/* Crea un pago en estado 'pendiente' (pasarela online) o 'en_revision'
   (transferencia con comprobante). Devuelve el id del pago. */
export async function registrarPago(sb, {
  empresaId, plan, ciclo, pasarela, monto, moneda, estado = 'pendiente',
  comprobanteUrl = null, referencia = null, nota = null,
}) {
  const meses = (CICLOS[ciclo] || CICLOS.mensual).meses;
  const per = periodoDe(meses);
  const { data, error } = await sb.from('pagos_saas_historial').insert({
    empresa_id: empresaId,
    plan,
    monto,
    moneda,
    pasarela,
    estado,
    referencia_externa: referencia,
    comprobante_url: comprobanteUrl,
    periodo_desde: per.desde,
    periodo_hasta: per.hasta,
    nota,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function asignarReferencia(sb, pagoId, referencia) {
  await sb.from('pagos_saas_historial').update({ referencia_externa: referencia }).eq('id', pagoId);
}

export async function pagoPorId(sb, id) {
  const { data } = await sb.from('pagos_saas_historial').select('*').eq('id', id).maybeSingle();
  return data || null;
}

export async function pagoPorReferencia(sb, referencia) {
  const { data } = await sb.from('pagos_saas_historial').select('*')
    .eq('referencia_externa', referencia).maybeSingle();
  return data || null;
}

export async function marcarPago(sb, pagoId, { estado, aprobadoPor = null, referencia = null, nota = undefined }) {
  const cambios = { estado };
  if (aprobadoPor) {
    cambios.aprobado_por = aprobadoPor;
    cambios.aprobado_at = new Date().toISOString();
  }
  if (referencia) cambios.referencia_externa = referencia;
  if (nota !== undefined) cambios.nota = nota;
  await sb.from('pagos_saas_historial').update(cambios).eq('id', pagoId);
}

/* Activa o extiende la suscripcion. Si la empresa tiene un vencimiento
   futuro, el nuevo periodo se suma a partir de esa fecha. */
export async function activarSuscripcion(sb, { empresaId, plan, meses = 1, hasta = null }) {
  const { data: actual } = await sb.from('suscripciones_empresas')
    .select('fecha_vencimiento').eq('empresa_id', empresaId).maybeSingle();

  let vencimiento;
  if (hasta) {
    vencimiento = new Date(hasta);
  } else {
    const base = actual?.fecha_vencimiento && new Date(actual.fecha_vencimiento) > new Date()
      ? new Date(actual.fecha_vencimiento)
      : new Date();
    vencimiento = new Date(base);
    vencimiento.setMonth(vencimiento.getMonth() + meses);
  }

  const fila = {
    plan,
    estado: 'activo',
    fecha_vencimiento: vencimiento.toISOString(),
    trial_ends_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('suscripciones_empresas')
    .upsert({ empresa_id: empresaId, ...fila }, { onConflict: 'empresa_id' });
  if (error) throw new Error(error.message);

  // Reflejar el plan contratado en empresas.plan (compatibilidad).
  await sb.from('empresas').update({ plan }).eq('id', empresaId);

  return { plan, fecha_vencimiento: vencimiento.toISOString() };
}

/* Numero de meses de un pago segun su periodo guardado. */
function mesesDePago(pago) {
  if (pago?.periodo_desde && pago?.periodo_hasta) {
    const desde = new Date(pago.periodo_desde);
    const hasta = new Date(pago.periodo_hasta);
    const meses = (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth());
    if (meses > 0) return meses;
  }
  return 1;
}

/* Confirma un pago (aprobado) y activa/extiende la suscripcion.
   Se usa desde los webhooks y desde la aprobacion manual del super-admin. */
export async function confirmarPago(sb, { pago, aprobadoPor = null, referencia = null, meses = null }) {
  if (!pago) return null;
  await marcarPago(sb, pago.id, { estado: 'aprobado', aprobadoPor, referencia });
  return activarSuscripcion(sb, {
    empresaId: pago.empresa_id,
    plan: pago.plan,
    meses: meses || mesesDePago(pago),
  });
}

export { planValido };

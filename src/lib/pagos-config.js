/* ============================================================
   Configuracion de pagos del SaaS (servidor).
   Lee la fila unica de `configuracion_pagos` y la mezcla con las
   variables de entorno como respaldo. Solo servidor.
   ============================================================ */

import { admin } from '@/lib/supabase';

let cache = null;
let cacheAt = 0;
const TTL = 30 * 1000; // 30 segundos

function env(nombre) {
  return (process.env[nombre] || '').trim();
}

function filaVacia() {
  return {
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    mercadopago_access_token: '',
    mercadopago_webhook_secret: '',
    paypal_client_id: '',
    paypal_secret: '',
    paypal_webhook_id: '',
    paypal_mode: 'sandbox',
    transferencia_banco: '',
    transferencia_cuenta: '',
    transferencia_titular: '',
    transferencia_rif: '',
    transferencia_instrucciones: '',
    transferencia_qr_url: '',
  };
}

/* Devuelve la configuracion efectiva (BD con respaldo de env). */
export async function leerConfigPagos({ force = false } = {}) {
  const ahora = Date.now();
  if (!force && cache && (ahora - cacheAt) < TTL) return cache;

  const base = filaVacia();
  try {
    const sb = admin();
    const { data } = await sb.from('configuracion_pagos').select('*').eq('id', 1).maybeSingle();
    if (data) {
      for (const k of Object.keys(base)) {
        if (data[k] !== null && data[k] !== undefined && data[k] !== '') base[k] = data[k];
      }
    }
  } catch { /* si la tabla no existe, se usan env */ }

  // Respaldo de variables de entorno
  base.stripe_secret_key = base.stripe_secret_key || env('STRIPE_SECRET_KEY');
  base.stripe_webhook_secret = base.stripe_webhook_secret || env('STRIPE_WEBHOOK_SECRET');
  base.mercadopago_access_token = base.mercadopago_access_token || env('MERCADOPAGO_ACCESS_TOKEN');
  base.mercadopago_webhook_secret = base.mercadopago_webhook_secret || env('MERCADOPAGO_WEBHOOK_SECRET');
  base.paypal_client_id = base.paypal_client_id || env('PAYPAL_CLIENT_ID');
  base.paypal_secret = base.paypal_secret || env('PAYPAL_SECRET');
  base.paypal_webhook_id = base.paypal_webhook_id || env('PAYPAL_WEBHOOK_ID');
  base.paypal_mode = base.paypal_mode || env('PAYPAL_MODE') || 'sandbox';

  cache = base;
  cacheAt = ahora;
  return base;
}

export function invalidarCacheConfigPagos() {
  cache = null;
  cacheAt = 0;
}

/* Datos publicos de transferencia (sin credenciales). */
export function datosTransferencia(config) {
  return {
    banco: config.transferencia_banco || '',
    cuenta: config.transferencia_cuenta || '',
    titular: config.transferencia_titular || '',
    rif: config.transferencia_rif || '',
    instrucciones: config.transferencia_instrucciones || '',
    qr_url: config.transferencia_qr_url || '',
  };
}

/* ============================================================
   Pasarelas de pago (servidor). Sin dependencias: `fetch` + node:crypto.

   Las credenciales se leen de la base (tabla configuracion_pagos) y,
   si faltan, de las variables de entorno. Ver src/lib/pagos-config.js.
   ============================================================ */

import crypto from 'node:crypto';

export const PASARELAS = ['stripe', 'mercadopago', 'paypal'];

export class PasarelaNoConfigurada extends Error {
  constructor(pasarela) {
    super(`La pasarela ${pasarela} no esta configurada todavia.`);
    this.name = 'PasarelaNoConfigurada';
    this.codigo = 'PasarelaNoConfigurada';
    this.pasarela = pasarela;
  }
  respuesta() {
    return Response.json(
      { ok: false, codigo: this.codigo, error: this.message, pasarela: this.pasarela },
      { status: 503 }
    );
  }
}

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventservonline.vercel.app')
    .replace(/\/+$/, '');
}

function urlRetorno(estado) {
  return `${appUrl()}/renderer?pago=${estado}`;
}

/* Indica si la pasarela tiene credenciales completas. */
export function configurada(pasarela, config = {}) {
  if (pasarela === 'stripe') return !!(config.stripe_secret_key && config.stripe_webhook_secret);
  if (pasarela === 'mercadopago') return !!(config.mercadopago_access_token && config.mercadopago_webhook_secret);
  if (pasarela === 'paypal') return !!(config.paypal_client_id && config.paypal_secret);
  return false;
}

/* Crea una sesion/preferencia/orden y devuelve la URL de pago. */
export async function crearCheckout(pasarela, datos, config = {}) {
  if (pasarela === 'stripe') return checkoutStripe(datos, config);
  if (pasarela === 'mercadopago') return checkoutMercadoPago(datos, config);
  if (pasarela === 'paypal') return checkoutPayPal(datos, config);
  throw new PasarelaNoConfigurada(pasarela);
}

/* ------------------------------------------------------------
   Stripe (Checkout Sessions)
   ------------------------------------------------------------ */
async function checkoutStripe({ pagoId, empresaId, plan, planNombre, monto, moneda, meses }, config) {
  const key = config.stripe_secret_key;
  if (!key || !config.stripe_webhook_secret) throw new PasarelaNoConfigurada('stripe');

  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', urlRetorno('ok'));
  body.set('cancel_url', urlRetorno('cancelada'));
  body.set('client_reference_id', pagoId);
  body.set('metadata[pago_id]', pagoId);
  body.set('metadata[empresa_id]', empresaId);
  body.set('metadata[plan]', plan);
  body.set('metadata[meses]', String(meses));
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', moneda.toLowerCase());
  body.set('line_items[0][price_data][unit_amount]', String(Math.round(monto * 100)));
  body.set('line_items[0][price_data][product_data][name]', `Plan ${planNombre}`);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error?.message || 'Stripe rechazo la sesion de pago');
  return { url: json.url, referencia: json.id };
}

/* ------------------------------------------------------------
   Mercado Pago (Preferences)
   ------------------------------------------------------------ */
async function checkoutMercadoPago({ pagoId, empresaId, planNombre, monto, moneda }, config) {
  const token = config.mercadopago_access_token;
  if (!token || !config.mercadopago_webhook_secret) throw new PasarelaNoConfigurada('mercadopago');

  const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ title: `Plan ${planNombre}`, quantity: 1, unit_price: Number(monto), currency_id: moneda }],
      external_reference: pagoId,
      metadata: { empresa_id: empresaId, pago_id: pagoId },
      notification_url: `${appUrl()}/api/webhooks/mercadopago`,
      back_urls: {
        success: urlRetorno('ok'),
        failure: urlRetorno('cancelada'),
        pending: urlRetorno('pendiente'),
      },
      auto_return: 'approved',
    }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.message || 'Mercado Pago rechazo la preferencia');
  return { url: json.init_point || json.sandbox_init_point, referencia: json.id };
}

/* ------------------------------------------------------------
   PayPal (Orders v2)
   ------------------------------------------------------------ */
function paypalBase(config) {
  return (config.paypal_mode === 'live')
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalToken(config) {
  const id = config.paypal_client_id;
  const secret = config.paypal_secret;
  if (!id || !secret) throw new PasarelaNoConfigurada('paypal');
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch(`${paypalBase(config)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.access_token) throw new Error('PayPal: no se pudo autenticar');
  return json.access_token;
}

async function checkoutPayPal({ pagoId, planNombre, monto, moneda }, config) {
  if (!configurada('paypal', config)) throw new PasarelaNoConfigurada('paypal');
  const token = await paypalToken(config);

  const r = await fetch(`${paypalBase(config)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: pagoId,
        custom_id: pagoId,
        description: `Plan ${planNombre}`,
        amount: { currency_code: moneda, value: Number(monto).toFixed(2) },
      }],
      application_context: {
        brand_name: 'inventserOnline',
        user_action: 'PAY_NOW',
        return_url: urlRetorno('ok'),
        cancel_url: urlRetorno('cancelada'),
      },
    }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.message || 'PayPal rechazo la orden');
  const link = (json.links || []).find((l) => l.rel === 'approve' || l.rel === 'payer-action');
  return { url: link?.href, referencia: json.id };
}

/* ------------------------------------------------------------
   Verificacion de firmas (webhooks)
   ------------------------------------------------------------ */

export function verificarStripe(raw, header, secret) {
  if (!secret || !header) return null;
  const partes = {};
  for (const trozo of header.split(',')) {
    const [k, v] = trozo.split('=');
    if (k && v) partes[k.trim()] = v.trim();
  }
  if (!partes.t || !partes.v1) return null;
  const esperado = crypto.createHmac('sha256', secret).update(`${partes.t}.${raw}`).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function verificarMercadoPago(headers, dataId, secret) {
  const firma = headers.get('x-signature');
  const requestId = headers.get('x-request-id') || '';
  if (!secret || !firma || !dataId) return false;
  const partes = {};
  for (const trozo of firma.split(',')) {
    const [k, v] = trozo.split('=');
    if (k && v) partes[k.trim()] = v.trim();
  }
  if (!partes.ts || !partes.v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${partes.ts};`;
  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return esperado === partes.v1;
}

export async function verificarPayPal(evento, headers, config) {
  const webhookId = config.paypal_webhook_id;
  if (!webhookId) return false;
  const token = await paypalToken(config);
  const r = await fetch(`${paypalBase(config)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_time: headers.get('paypal-transmission-time'),
      cert_url: headers.get('paypal-cert-url'),
      auth_algo: headers.get('paypal-auth-algo'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      webhook_id: webhookId,
      webhook_event: evento,
    }),
  });
  const json = await r.json().catch(() => ({}));
  return r.ok && json.verification_status === 'SUCCESS';
}

export async function obtenerPagoMercadoPago(id, config) {
  const token = config.mercadopago_access_token;
  if (!token) throw new PasarelaNoConfigurada('mercadopago');
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('No se pudo leer el pago en Mercado Pago');
  return r.json();
}

/* ------------------------------------------------------------
   Prueba de credenciales (sin cobrar)
   ------------------------------------------------------------ */
export async function probarCredenciales(pasarela, config) {
  if (pasarela === 'stripe') {
    const key = config.stripe_secret_key;
    if (!key) return { ok: false, error: 'Falta la secret key de Stripe' };
    const r = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: json?.error?.message || `HTTP ${r.status}` };
    return { ok: true, mensaje: `Stripe OK. Moneda: ${(json.available && json.available[0] && json.available[0].currency) || 'n/d'}` };
  }

  if (pasarela === 'mercadopago') {
    const token = config.mercadopago_access_token;
    if (!token) return { ok: false, error: 'Falta el access token de Mercado Pago' };
    const r = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: json?.message || `HTTP ${r.status}` };
    return { ok: true, mensaje: `Mercado Pago OK. Usuario: ${json.nickname || json.id || 'n/d'}` };
  }

  if (pasarela === 'paypal') {
    try {
      const token = await paypalToken(config);
      return { ok: true, mensaje: `PayPal OK (${config.paypal_mode === 'live' ? 'live' : 'sandbox'}). Token obtenido.` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { ok: false, error: 'Pasarela invalida' };
}

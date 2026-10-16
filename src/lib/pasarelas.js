/* ============================================================
   Pasarelas de pago (servidor). Sin dependencias: se usa `fetch`
   global y node:crypto para las firmas.

   Si una pasarela no esta configurada (faltan variables de entorno)
   `configurada()` devuelve false y `crearCheckout` lanza
   PasarelaNoConfigurada, que la API traduce a 503.

   Variables de entorno:
     APP_URL                       URL publica de la app (para retornos)
     STRIPE_SECRET_KEY             sk_...
     STRIPE_WEBHOOK_SECRET         whsec_...
     MERCADOPAGO_ACCESS_TOKEN      APP_USR-...
     MERCADOPAGO_WEBHOOK_SECRET    clave secreta del webhook
     PAYPAL_CLIENT_ID              ...
     PAYPAL_SECRET                 ...
     PAYPAL_WEBHOOK_ID             id del webhook en PayPal
     PAYPAL_MODE                   'sandbox' (por defecto) | 'live'
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

function cfg(nombre) {
  return (process.env[nombre] || '').trim();
}

function appUrl() {
  return (cfg('APP_URL') || cfg('NEXT_PUBLIC_APP_URL') || 'https://inventservonline.vercel.app')
    .replace(/\/+$/, '');
}

function urlRetorno(estado) {
  return `${appUrl()}/renderer?pago=${estado}`;
}

export function configurada(pasarela) {
  if (pasarela === 'stripe') return !!(cfg('STRIPE_SECRET_KEY') && cfg('STRIPE_WEBHOOK_SECRET'));
  if (pasarela === 'mercadopago') return !!(cfg('MERCADOPAGO_ACCESS_TOKEN') && cfg('MERCADOPAGO_WEBHOOK_SECRET'));
  if (pasarela === 'paypal') return !!(cfg('PAYPAL_CLIENT_ID') && cfg('PAYPAL_SECRET'));
  return false;
}

/* Crea una sesion/preferencia/orden y devuelve la URL de pago. */
export async function crearCheckout(pasarela, datos) {
  if (pasarela === 'stripe') return checkoutStripe(datos);
  if (pasarela === 'mercadopago') return checkoutMercadoPago(datos);
  if (pasarela === 'paypal') return checkoutPayPal(datos);
  throw new PasarelaNoConfigurada(pasarela);
}

/* ------------------------------------------------------------
   Stripe (Checkout Sessions, API REST)
   ------------------------------------------------------------ */
async function checkoutStripe({ pagoId, empresaId, plan, planNombre, monto, moneda, meses }) {
  const key = cfg('STRIPE_SECRET_KEY');
  if (!key || !cfg('STRIPE_WEBHOOK_SECRET')) throw new PasarelaNoConfigurada('stripe');

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
   Mercado Pago (Preferences, API REST)
   ------------------------------------------------------------ */
async function checkoutMercadoPago({ pagoId, empresaId, planNombre, monto, moneda }) {
  const token = cfg('MERCADOPAGO_ACCESS_TOKEN');
  if (!token || !cfg('MERCADOPAGO_WEBHOOK_SECRET')) throw new PasarelaNoConfigurada('mercadopago');

  const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{
        title: `Plan ${planNombre}`,
        quantity: 1,
        unit_price: Number(monto),
        currency_id: moneda,
      }],
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
   PayPal (Orders v2, API REST)
   ------------------------------------------------------------ */
function paypalBase() {
  return cfg('PAYPAL_MODE') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalToken() {
  const id = cfg('PAYPAL_CLIENT_ID');
  const secret = cfg('PAYPAL_SECRET');
  if (!id || !secret) throw new PasarelaNoConfigurada('paypal');
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
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

async function checkoutPayPal({ pagoId, planNombre, monto, moneda }) {
  if (!configurada('paypal')) throw new PasarelaNoConfigurada('paypal');
  const token = await paypalToken();

  const r = await fetch(`${paypalBase()}/v2/checkout/orders`, {
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

/* Stripe: header "t=...,v1=...", firma = HMAC_SHA256(secret, `${t}.${raw}`). */
export function verificarStripe(raw, header, secret = cfg('STRIPE_WEBHOOK_SECRET')) {
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

/* Mercado Pago: header "x-signature: ts=...,v1=...",
   manifest = `id:${dataId};request-id:${requestId};ts:${ts};`. */
export function verificarMercadoPago(headers, dataId, secret = cfg('MERCADOPAGO_WEBHOOK_SECRET')) {
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

/* PayPal: se verifica contra su API (requiere PAYPAL_WEBHOOK_ID). */
export async function verificarPayPal(evento, headers) {
  const webhookId = cfg('PAYPAL_WEBHOOK_ID');
  if (!webhookId) return false;
  const token = await paypalToken();
  const r = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_time: headers.get('paypal-transmission-time'),
      cert_url: headers.get('paypal-cert-url'),
      auth_algo: headers.get('paypal-auth-algo'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      webhook_id: cfg('PAYPAL_WEBHOOK_ID'),
      webhook_event: event,
    }),
  });
  const json = await r.json().catch(() => ({}));
  return r.ok && json.verification_status === 'SUCCESS';
}

/* Lee un pago de Mercado Pago para conocer su estado real. */
export async function obtenerPagoMercadoPago(id) {
  const token = cfg('MERCADOPAGO_ACCESS_TOKEN');
  if (!token) throw new PasarelaNoConfigurada('mercadopago');
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('No se pudo leer el pago en Mercado Pago');
  return r.json();
}

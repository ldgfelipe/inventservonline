import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';
import { invalidarCacheConfigPagos } from '@/lib/pagos-config';

export const runtime = 'nodejs';

const CAMPOS_SECRETOS = [
  'stripe_secret_key', 'stripe_webhook_secret',
  'mercadopago_access_token', 'mercadopago_webhook_secret',
  'paypal_client_id', 'paypal_secret', 'paypal_webhook_id',
];

/* GET /api/admin/config-pagos -> config (secretos enmascarados) */
async function leer(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sb = admin();
  const { data, error: err } = await sb.from('configuracion_pagos').select('*').eq('id', 1).maybeSingle();
  if (err) {
    if (/configuracion_pagos|does not exist|schema cache/i.test(err.message)) {
      return Response.json({ ok: true, config: null, aviso: 'Falta aplicar la migracion 032 (configuracion de pagos).' });
    }
    return error(err.message, 500);
  }

  const cfg = data || {};
  const salida = {
    paypal_mode: cfg.paypal_mode || 'sandbox',
    transferencia_banco: cfg.transferencia_banco || '',
    transferencia_cuenta: cfg.transferencia_cuenta || '',
    transferencia_titular: cfg.transferencia_titular || '',
    transferencia_rif: cfg.transferencia_rif || '',
    transferencia_instrucciones: cfg.transferencia_instrucciones || '',
    transferencia_qr_url: cfg.transferencia_qr_url || '',
    // Indicadores de si ya hay credenciales guardadas (sin exponerlas)
    tiene_stripe: !!(cfg.stripe_secret_key),
    tiene_stripe_webhook: !!(cfg.stripe_webhook_secret),
    tiene_mercadopago: !!(cfg.mercadopago_access_token),
    tiene_mercadopago_webhook: !!(cfg.mercadopago_webhook_secret),
    tiene_paypal: !!(cfg.paypal_client_id && cfg.paypal_secret),
    tiene_paypal_webhook: !!(cfg.paypal_webhook_id),
  };
  return Response.json({ ok: true, config: salida });
}

/* POST /api/admin/config-pagos
   Solo actualiza los campos enviados y no vacios. Para borrar un campo
   se puede enviar `{ campo: '' }` explicitamente con `borrar: true`. */
async function guardar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const sb = admin();
  const cambios = { updated_at: new Date().toISOString() };

  const noSecretos = [
    'paypal_mode',
    'transferencia_banco', 'transferencia_cuenta', 'transferencia_titular',
    'transferencia_rif', 'transferencia_instrucciones', 'transferencia_qr_url',
  ];
  for (const k of noSecretos) {
    if (cuerpo[k] !== undefined) cambios[k] = cuerpo[k] || (k === 'paypal_mode' ? 'sandbox' : '');
  }
  if (cambios.paypal_mode && !['sandbox', 'live'].includes(cambios.paypal_mode)) {
    return error('paypal_mode debe ser sandbox o live');
  }

  // Secretos: solo se actualizan si vienen con valor, salvo que pidan borrar.
  for (const k of CAMPOS_SECRETOS) {
    if (cuerpo[k] !== undefined && String(cuerpo[k]).trim() !== '') {
      cambios[k] = String(cuerpo[k]).trim();
    } else if (cuerpo.borrar && Array.isArray(cuerpo.borrar) && cuerpo.borrar.includes(k)) {
      cambios[k] = null;
    }
  }

  const { data: existe } = await sb.from('configuracion_pagos').select('id').eq('id', 1).maybeSingle();
  if (existe) {
    const { error: err } = await sb.from('configuracion_pagos').update(cambios).eq('id', 1);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  } else {
    const { error: err } = await sb.from('configuracion_pagos').insert({ id: 1, ...cambios });
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  }

  invalidarCacheConfigPagos();
  return Response.json({ ok: true });
}

export const GET = manejar(leer);
export const POST = manejar(guardar);

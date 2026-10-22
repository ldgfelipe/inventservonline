import { admin } from '@/lib/supabase';
import { verificarMercadoPago, obtenerPagoMercadoPago } from '@/lib/pasarelas';
import { leerConfigPagos } from '@/lib/pagos-config';
import { pagoPorId, confirmarPago } from '@/lib/pagos';

export const runtime = 'nodejs';

/* POST /api/webhooks/mercadopago
   Verifica x-signature (MERCADOPAGO_WEBHOOK_SECRET), consulta el pago
   real en la API de Mercado Pago y activa la suscripcion si fue aprobado. */
export async function POST(request) {
  const raw = await request.text();
  let cuerpo = {};
  try { cuerpo = JSON.parse(raw || '{}'); } catch { cuerpo = {}; }

  const porQuery = new URL(request.url).searchParams.get('data.id');
  const dataId = cuerpo?.data?.id || porQuery || null;

  // Sin id de recurso no hay nada que procesar (p. ej. ping de verificacion).
  if (!dataId) return Response.json({ received: true });

  const config = await leerConfigPagos();
  if (!verificarMercadoPago(request.headers, dataId, config.mercadopago_webhook_secret)) {
    return new Response('Firma invalida', { status: 400 });
  }

  try {
    const pagoMp = await obtenerPagoMercadoPago(dataId, config);
    if (pagoMp?.status === 'approved') {
      const pagoId = pagoMp.external_reference || cuerpo?.data?.id;
      const sb = admin();
      const pago = await pagoPorId(sb, pagoId);
      if (pago) {
        await confirmarPago(sb, { pago, referencia: String(pagoMp.id || dataId) });
      }
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error('Webhook Mercado Pago:', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

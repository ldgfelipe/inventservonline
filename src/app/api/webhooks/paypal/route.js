import { admin } from '@/lib/supabase';
import { verificarPayPal } from '@/lib/pasarelas';
import { pagoPorId, confirmarPago } from '@/lib/pagos';

export const runtime = 'nodejs';

/* POST /api/webhooks/paypal
   Verifica la firma contra la API de PayPal (PAYPAL_WEBHOOK_ID) y
   activa la suscripcion cuando la captura se completa. */
export async function POST(request) {
  const raw = await request.text();
  let evento = {};
  try { evento = JSON.parse(raw || '{}'); } catch { return new Response('JSON invalido', { status: 400 }); }

  let valido = false;
  try {
    valido = await verificarPayPal(evento, request.headers);
  } catch (err) {
    console.error('Verificacion PayPal:', err.message);
    return new Response('No se pudo verificar la firma', { status: 400 });
  }
  if (!valido) return new Response('Firma invalida', { status: 400 });

  try {
    if (evento.event_type === 'PAYMENT.CAPTURE.COMPLETED' || evento.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const recurso = evento.resource || {};
      const pagoId =
        recurso.custom_id ||
        recurso.purchase_units?.[0]?.custom_id ||
        recurso.purchase_units?.[0]?.reference_id ||
        null;
      if (pagoId) {
        const sb = admin();
        const pago = await pagoPorId(sb, pagoId);
        if (pago) {
          await confirmarPago(sb, {
            pago,
            referencia: recurso.id || recurso.supplementary_data?.related_ids?.order_id || null,
          });
        }
      }
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error('Webhook PayPal:', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

import { admin } from '@/lib/supabase';
import { verificarStripe } from '@/lib/pasarelas';
import { leerConfigPagos } from '@/lib/pagos-config';
import { pagoPorId, confirmarPago, activarSuscripcion } from '@/lib/pagos';

export const runtime = 'nodejs';

/* POST /api/webhooks/stripe
   Endpoint publico (ver PUBLICAS en middleware.js). Verifica la firma
   con STRIPE_WEBHOOK_SECRET y activa la suscripcion al confirmarse el
   pago. Se responde 400 si la firma no es valida y 200 si se proceso
   (aunque el evento no nos interese) para evitar reintentos en bucle. */
export async function POST(request) {
  const raw = await request.text();
  const config = await leerConfigPagos();
  const evento = verificarStripe(raw, request.headers.get('stripe-signature'), config.stripe_webhook_secret);
  if (!evento) return new Response('Firma invalida', { status: 400 });

  try {
    const tipo = evento.type;
    if (tipo === 'checkout.session.completed' || tipo === 'checkout.session.async_payment_succeeded') {
      const s = evento.data?.object || {};
      const pagoId = (s.metadata && evento.data?.object?.metadata?.pago_id) || evento.data?.object?.client_reference_id;
      const empresaId = evento.data?.object?.metadata?.empresa_id;
      const plan = evento.data?.object?.metadata?.plan;
      const meses = Number(evento.data?.object?.metadata?.meses) || 1;
      const referencia = evento.data?.object?.payment_intent || evento.data?.object?.id || null;

      const sb = admin();
      const pago = pagoId ? await pagoPorId(sb, pagoId) : null;
      if (pago) {
        await confirmarPago(sb, { pago, referencia, meses });
      } else if (evento.data?.object?.metadata?.empresa_id && plan) {
        // Sin fila de pago (caso raro): activamos con los datos del metadata.
        await activarSuscripcion(admin(), {
          empresaId: evento.data.object.metadata.empresa_id, plan, meses,
        });
      }
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error('Webhook Stripe:', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

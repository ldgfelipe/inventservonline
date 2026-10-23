import { error, sesion, manejar, auditar } from '@/lib/auth';
import { leerConfigPagos } from '@/lib/pagos-config';
import { pagoPorId, confirmarPago } from '@/lib/pagos';
import { obtenerSesionStripe } from '@/lib/pasarelas';

export const runtime = 'nodejs';

/* POST /api/pagos/confirmar { session_id }
   Se llama al volver de Stripe. Verifica la sesion contra Stripe y, si
   esta pagada, aprueba el pago y activa el plan. Es idempotente: si el
   webhook ya lo hizo, no extiende dos veces la suscripcion. */
async function confirmar(request) {
  const { perfil, sb } = await sesion(request);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const sessionId = String(cuerpo.session_id || '').trim();
  if (!sessionId) return error('Falta session_id');

  const config = await leerConfigPagos();
  if (!config.stripe_secret_key) return error('Stripe no esta configurado', 503);

  let sesionStripe;
  try {
    sesionStripe = await obtenerSesionStripe(sessionId, config);
  } catch (err) {
    return error('No se pudo verificar el pago en Stripe: ' + err.message, 502);
  }

  const pagoId = sesionStripe?.metadata?.pago_id || sesionStripe?.client_reference_id || null;
  if (!pagoId) return error('La sesion de Stripe no tiene referencia de pago', 400);

  const pago = await pagoPorId(sb, pagoId);
  if (!pago) return error('Pago no encontrado', 404);
  if (pago.empresa_id !== perfil.empresa_id) return error('Ese pago no corresponde a tu empresa', 403);

  const pagado = sesionStripe.payment_status === 'paid'
    || sesionStripe.payment_status === 'no_payment_required';

  if (!pagado) {
    return Response.json({
      ok: true,
      pagado: false,
      estado: pago.estado,
      estado_stripe: sesionStripe.payment_status,
      mensaje: 'Stripe todavia no confirma el pago. Te avisaremos cuando se acredite.',
    });
  }

  if (pago.estado !== 'aprobado') {
    await confirmarPago(sb, {
      pago,
      referencia: sesionStripe.payment_intent || sesionStripe.id || null,
      meses: Number(sesionStripe?.metadata?.meses) || null,
    });
    await auditar(sb, perfil, {
      accion: 'pago.confirmar', entidad: 'pago', entidadId: pago.id,
      detalle: 'stripe session=' + sessionId,
    });
  }

  return Response.json({ ok: true, pagado: true, plan: pago.plan });
}

export const POST = manejar(confirmar);

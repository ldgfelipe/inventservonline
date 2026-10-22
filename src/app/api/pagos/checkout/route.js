import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { planValido } from '@/lib/planes';
import {
  PASARELAS_PAGO, cicloValido, precioDe, registrarPago, asignarReferencia, esquemaFaltante,
} from '@/lib/pagos';
import { crearCheckout, configurada } from '@/lib/pasarelas';
import { leerConfigPagos } from '@/lib/pagos-config';

export const runtime = 'nodejs';

/* POST /api/pagos/checkout { plan, ciclo, pasarela }
   Crea un pago pendiente y devuelve la URL de la pasarela. */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const plan = String(cuerpo.plan || '').trim().toLowerCase();
  const ciclo = String(cuerpo.ciclo || 'mensual').trim().toLowerCase();
  const pasarela = String(cuerpo.pasarela || '').trim().toLowerCase();

  if (!planValido(plan)) return error('Plan invalido');
  if (plan === 'free') return error('El plan Gratis no requiere pago');
  if (!cicloValido(ciclo)) return error('Ciclo invalido (mensual o anual)');
  if (!PASARELAS_PAGO.includes(pasarela) || pasarela === 'transferencia') {
    return error('Pasarela invalida para pago en linea');
  }
  const config = await leerConfigPagos();
  if (!configurada(pasarela, config)) {
    return error(`La pasarela ${pasarela} no esta configurada todavia`, 503);
  }

  const { monto, moneda, meses, planNombre } = precioDe(plan, ciclo);

  let pagoId;
  try {
    pagoId = await registrarPago(sb, {
      empresaId: perfil.empresa_id, plan, ciclo, pasarela, monto, moneda, estado: 'pendiente',
    });
  } catch (err) {
    if (esquemaFaltante(err)) return error('Falta aplicar la migracion 013 (pagos y planes)', 409);
    return error('No se pudo iniciar el pago: ' + err.message, 500);
  }

  let salida;
  try {
    salida = await crearCheckout(pasarela, {
      pagoId, empresaId: perfil.empresa_id, plan, planNombre, monto, moneda, meses,
    }, config);
  } catch (err) {
    if (err && typeof err.respuesta === 'function') throw err; // PasarelaNoConfigurada
    return error('La pasarela no respondio: ' + err.message, 502);
  }

  if (!salida?.url) return error('La pasarela no devolvio una URL de pago', 502);

  if (salida.referencia) await asignarReferencia(sb, pagoId, String(salida.referencia));
  await auditar(sb, perfil, {
    accion: 'pago.iniciar', entidad: 'pago', entidadId: pagoId,
    detalle: `${pasarela} plan=${plan} ciclo=${ciclo} monto=${monto} ${moneda}`,
  });

  return Response.json({ ok: true, url: salida.url, pago_id: pagoId }, { status: 201 });
}

export const POST = manejar(crear);

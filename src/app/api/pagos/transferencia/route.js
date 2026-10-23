import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { precioDe, registrarPago, cicloValido, esquemaFaltante } from '@/lib/pagos';
import { planValido } from '@/lib/planes';
import { leerConfigPagos } from '@/lib/pagos-config';

export const runtime = 'nodejs';

/* POST /api/pagos/transferencia { plan, ciclo, comprobante_url, referencia?, nota? }
   Registra una transferencia bancaria manual. Queda en estado
   'en_revision' hasta que un super-admin la apruebe desde /admin. */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const plan = String(cuerpo.plan || '').trim().toLowerCase();
  const ciclo = String(cuerpo.ciclo || 'mensual').trim().toLowerCase();
  const comprobanteUrl = String(cuerpo.comprobante_url || '').trim();

  if (!cicloValido(ciclo)) return error('Ciclo invalido');
  if (!planValido(plan) || plan === 'free') {
    return error('Elige un plan de pago valido (Basico, Profesional o Empresa)');
  }
  if (!comprobanteUrl || !/^https?:\/\//i.test(comprobanteUrl)) {
    return error('Adjunta la URL del comprobante (debe empezar por http)');
  }

  // El super-admin puede deshabilitar la transferencia bancaria.
  const config = await leerConfigPagos();
  if (config.transferencia_activa === false) {
    return error('La transferencia bancaria no esta habilitada', 403);
  }

  const { monto, moneda } = precioDe(plan, ciclo);

  let pagoId;
  try {
    pagoId = await registrarPago(sb, {
      empresaId: perfil.empresa_id,
      plan, ciclo,
      pasarela: 'transferencia',
      monto, moneda,
      estado: 'en_revision',
      comprobanteUrl,
      referencia: String(cuerpo.referencia || '').trim() || null,
      nota: String(cuerpo.nota || '').trim() || null,
    });
  } catch (err) {
    if (esquemaFaltante(err)) return error('Falta aplicar la migracion 013 (pagos y planes)', 409);
    return error('No se pudo registrar la transferencia: ' + err.message, 500);
  }

  await auditar(sb, perfil, {
    accion: 'pago.transferencia', entidad: 'pago', entidadId: pagoId,
    detalle: `plan=${plan} ciclo=${ciclo} monto=${monto} ${moneda}`,
  });

  return Response.json({
    ok: true,
    pago_id: pagoId,
    estado: 'en_revision',
    mensaje: 'Transferencia registrada. Un administrador la revisara y activara tu plan.',
  }, { status: 201 });
}

export const POST = manejar(crear);

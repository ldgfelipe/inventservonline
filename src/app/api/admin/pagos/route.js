import { error, sesion, manejar, auditar } from '@/lib/auth';
import { pagoPorId, confirmarPago, marcarPago } from '@/lib/pagos';

export const runtime = 'nodejs';

/* Panel de pagos del super-admin:
   - GET  /api/admin/pagos?estado=en_revision  -> lista pagos (de todas las empresas)
   - POST /api/admin/pagos { id, accion }      -> aprobar | rechazar */
function soloSuper(perfil) {
  return !!perfil.super_admin;
}

async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!soloSuper(perfil)) return error('Solo administradores de la plataforma', 403);

  const estado = new URL(request.url).searchParams.get('estado');

  let consulta = sb.from('pagos_saas_historial')
    .select('id, empresa_id, plan, monto, moneda, pasarela, estado, referencia_externa, comprobante_url, periodo_desde, periodo_hasta, nota, created_at, aprobado_at, empresas(nombre)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (estado) consulta = consulta.eq('estado', estado);

  const { data, error: err } = await consulta;
  if (err) return error(err.message, 500);

  const pagos = (data || []).map((p) => ({
    ...p,
    empresa: p.empresas?.nombre || null,
    empresas: undefined,
  }));
  return Response.json({ ok: true, pagos });
}

async function resolver(request) {
  const { perfil, sb } = await sesion(request);
  if (!soloSuper(perfil)) return error('Solo administradores de la plataforma', 403);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const id = String(cuerpo.id || '').trim();
  const accion = String(cuerpo.accion || '').trim().toLowerCase();
  if (!id) return error('Falta el id del pago');
  if (!['aprobar', 'rechazar'].includes(accion)) return error('Accion invalida');

  const pago = await pagoPorId(sb, id);
  if (!pago) return error('Pago no encontrado', 404);
  if (pago.estado === 'aprobado') return error('Ese pago ya estaba aprobado', 409);

  if (accion === 'rechazar') {
    await marcarPago(sb, id, { estado: 'rechazado', aprobadoPor: perfil.id, nota: cuerpo.nota || pago.nota });
    await auditar(sb, perfil, { accion: 'pago.rechazar', entidad: 'pago', entidadId: id, detalle: pago.plan });
    return Response.json({ ok: true, estado: 'rechazado' });
  }

  // Aprobar: activa/extiende la suscripcion de la empresa del pago.
  const activado = await confirmarPago(sb, { pago, aprobadoPor: perfil.id });
  await auditar(sb, perfil, {
    accion: 'pago.aprobar', entidad: 'pago', entidadId: id,
    detalle: `${pago.plan} hasta ${activado?.fecha_vencimiento || ''}`,
  });
  return Response.json({ ok: true, estado: 'aprobado', suscripcion: activado });
}

export const GET = manejar(listar);
export const POST = manejar(resolver);

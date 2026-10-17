import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/facturacion/timbrar { venta_id } */
async function timbrar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'ventas.ver');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const ventaId = String(cuerpo.venta_id || '').trim();
  if (!ventaId) return error('Falta venta_id');

  // Cargar config
  const { data: config } = await sb.from('facturacion_config').select('*').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (!config) return error('No hay configuracion de facturacion. Configurala en Configuracion.', 400);

  // Cargar venta + detalle
  const { data: venta } = await sb.from('ventas').select('*, clientes(nombre, rif)').eq('empresa_id', perfil.empresa_id).eq('id', ventaId).maybeSingle();
  if (!venta) return error('Venta no encontrada', 404);
  const { data: detalle } = await sb.from('venta_detalle').select('*, productos(nombre, codigo)').eq('empresa_id', perfil.empresa_id).eq('venta_id', ventaId);

  const { timbrar: timbrarFn } = await import('@/lib/facturacion');
  const resultado = await timbrarFn(venta, detalle || [], config);

  if (resultado.ok) {
    // Incrementar folio
    await sb.from('facturacion_config').update({ folio_inicial: (config.folio_inicial || 1) + 1, status: 'activo', ultimo_error: null, updated_at: new Date().toISOString() }).eq('empresa_id', perfil.empresa_id);
    await auditar(sb, perfil, { accion: 'facturacion.timbrar', entidad: 'venta', entidadId: ventaId, detalle: resultado.uuid || resultado.folio });
  } else {
    await sb.from('facturacion_config').update({ status: 'error', ultimo_error: resultado.error, updated_at: new Date().toISOString() }).eq('empresa_id', perfil.empresa_id);
  }

  return Response.json({ ok: resultado.ok, ...resultado }, { status: resultado.ok ? 200 : 400 });
}

export const POST = manejar(timbrar);

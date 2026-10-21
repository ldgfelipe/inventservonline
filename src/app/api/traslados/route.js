import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/traslados -> traslados de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');
  await exigirModulo(sb, perfil, 'multi_almacen');
  const { data, error: err } = await sb.from('traslados')
    .select('*, productos(nombre, codigo), ao:almacenes!traslados_almacen_origen_fkey(nombre), ad:almacenes!traslados_almacen_destino_fkey(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false }).limit(200);
  if (err) {
    if (/traslados|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, traslados: [] });
    return error(err.message, 500);
  }
  const traslados = (data || []).map((t) => ({
    ...t,
    producto_nombre: t.productos ? t.productos.nombre : null,
    producto_codigo: t.productos ? t.productos.codigo : null,
    almacen_origen_nombre: t.ao ? t.ao.nombre : null,
    almacen_destino_nombre: t.ad ? t.ad.nombre : null,
    productos: undefined, ao: undefined, ad: undefined,
  }));
  return Response.json({ ok: true, traslados });
}

/* POST /api/traslados { producto_id, almacen_origen, almacen_destino, cantidad, observacion? } */
async function crear(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'productos.editar');
  await exigirModulo(sb, perfil, 'multi_almacen');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  if (!cuerpo.producto_id) return error('Falta el producto');
  if (!cuerpo.almacen_origen) return error('Falta el almacen de origen');
  if (!cuerpo.almacen_destino) return error('Falta el almacen de destino');
  if (cuerpo.almacen_origen === cuerpo.almacen_destino) return error('Origen y destino deben ser diferentes');
  const cantidad = Number(cuerpo.cantidad);
  if (!cantidad || cantidad <= 0) return error('Cantidad invalida');

  try {
    const { data, error: err } = await sbRpc.rpc('registrar_traslado', {
      p_producto: cuerpo.producto_id,
      p_almacen_origen: cuerpo.almacen_origen,
      p_almacen_destino: cuerpo.almacen_destino,
      p_cantidad: cantidad,
      p_observacion: cuerpo.observacion || null,
    });
    if (err) return error(err.message, 400);
    await auditar(sb, perfil, { accion: 'traslado.crear', entidad: 'traslado', entidadId: data.traslado_id, detalle: `cantidad ${cantidad}` });
    return Response.json({ ok: true, ...data }, { status: 201 });
  } catch (e) { return error(e.message || 'Error al registrar el traslado', 400); }
}

export const GET = manejar(listar);
export const POST = manejar(crear);

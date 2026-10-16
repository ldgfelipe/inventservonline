import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/ventas/[id] -> venta con su detalle */
async function obtener(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'ventas.ver');
  const id = params.id;
  const { data: venta, error: err } = await sb.from('ventas')
    .select('*, clientes(nombre, rif, telefono)').eq('empresa_id', perfil.empresa_id).eq('id', id).maybeSingle();
  if (err) return error(err.message, 500);
  if (!venta) return error('Venta no encontrada', 404);
  const { data: detalle } = await sb.from('venta_detalle')
    .select('*, productos(nombre, codigo)').eq('empresa_id', perfil.empresa_id).eq('venta_id', id);
  const det = (detalle || []).map((d) => ({
    ...d, producto_nombre: d.productos ? d.productos.nombre : null,
    producto_codigo: d.productos ? d.productos.codigo : null, productos: undefined,
  }));
  return Response.json({ ok: true, venta: { ...venta, cliente_nombre: venta.clientes?.nombre }, detalle: det });
}

export const GET = manejar(obtener);

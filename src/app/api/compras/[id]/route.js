import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/compras/[id] -> compra con su detalle */
async function obtener(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'compras.ver');
  const id = params.id;
  const { data: compra, error: err } = await sb.from('compras')
    .select('*, proveedores(nombre)').eq('empresa_id', perfil.empresa_id).eq('id', id).maybeSingle();
  if (err) return error(err.message, 500);
  if (!compra) return error('Compra no encontrada', 404);
  const { data: detalle } = await sb.from('compra_detalle')
    .select('*, productos(nombre, codigo)').eq('empresa_id', perfil.empresa_id).eq('compra_id', id);
  const det = (detalle || []).map((d) => ({
    ...d, producto_nombre: d.productos ? d.productos.nombre : null,
    producto_codigo: d.productos ? d.productos.codigo : null, productos: undefined,
  }));
  return Response.json({ ok: true, compra: { ...compra, proveedor_nombre: compra.proveedores?.nombre }, detalle: det });
}

export const GET = manejar(obtener);

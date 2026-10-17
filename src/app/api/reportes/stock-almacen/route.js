import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/reportes/stock-almacen -> stock por producto y almacen */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');
  const { data: almacenes } = await sb.from('almacenes').select('id, nombre, principal').eq('empresa_id', perfil.empresa_id).eq('activo', true);
  const { data: stock } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
  const { data: productos } = await sb.from('productos').select('id, codigo, nombre, stock_actual, stock_minimo').eq('empresa_id', perfil.empresa_id).eq('activo', true);

  const porProducto = {};
  for (const s of stock || []) {
    if (!porProducto[s.producto_id]) porProducto[s.producto_id] = {};
    porProducto[s.producto_id][s.almacen_id] = s.cantidad;
  }

  const filas = (productos || []).map((p) => {
    const detalle = (almacenes || []).map((a) => ({
      almacen_id: a.id,
      almacen: a.nombre,
      principal: a.principal,
      cantidad: (porProducto[p.id] && porProducto[p.id][a.id]) || 0,
    }));
    return {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      stock_total: p.stock_actual,
      stock_minimo: p.stock_minimo,
      por_almacen: detalle,
    };
  });

  return Response.json({ ok: true, almacenes: almacenes || [], productos: filas });
}

export const GET = manejar(listar);

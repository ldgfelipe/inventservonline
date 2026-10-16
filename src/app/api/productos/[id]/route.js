import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/productos/[id] */
async function obtener(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');
  const { id } = await params;

  const { data, error: err } = await sb
    .from('productos')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .eq('id', id)
    .maybeSingle();

  if (err) return error(err.message, 500);
  if (!data) return error('Producto no encontrado', 404);
  return Response.json({ ok: true, producto: data });
}

/* PATCH /api/productos/[id] */
async function actualizar(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.editar');
  const { id } = await params;

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error('Cuerpo JSON invalido');
  }
  const datos = cuerpo.datos || cuerpo;

  const { data: previo } = await sb.from('productos').select('nombre')
    .eq('empresa_id', perfil.empresa_id).eq('id', id).maybeSingle();
  if (!previo) return error('Producto no encontrado', 404);

  const base = {
    codigo: datos.codigo || null,
    nombre: String(datos.nombre).trim(),
    categoria_id: datos.categoria_id || null,
    proveedor_id: datos.proveedor_id || null,
    stock_minimo: Number(datos.stock_minimo) || 0,
    stock_maximo: Number(datos.stock_maximo) || 0,
    stock_actual: Number(datos.stock_actual) || 0,
    precio_compra: Number(datos.precio_compra) || 0,
    precio_venta: Number(datos.precio_venta) || 0,
    ubicacion: datos.ubicacion || null,
    updated_at: new Date().toISOString(),
  };
  const extra = {
    punto_reorden: Number(datos.punto_reorden) || 0,
    unidad: (datos.unidad || 'unidad').trim() || 'unidad',
    lote: datos.lote || null,
    fecha_vencimiento: datos.fecha_vencimiento || null,
  };

  // Si la migracion 010 aun no esta aplicada, se reintenta sin las
  // columnas nuevas para no bloquear la edicion.
  let { error: err } = await sb
    .from('productos')
    .update({ ...base, ...extra })
    .eq('empresa_id', perfil.empresa_id)
    .eq('id', id);

  if (err && /column|punto_reorden|unidad|lote|fecha_vencimiento|schema cache/i.test(err.message)) {
    ({ error: err } = await sb
      .from('productos')
      .update(base)
      .eq('empresa_id', perfil.empresa_id)
      .eq('id', id));
  }

  if (err) {
    if (err.code === '23505') return error('Ya existe un producto con ese codigo', 409);
    return error('No se pudo actualizar: ' + err.message, 500);
  }

  const { guardarCampos } = await import('../route');
  await guardarCampos(sb, perfil.empresa_id, id, cuerpo.camposDinamicos || []);
  await auditar(sb, perfil, { accion: 'producto.editar', entidad: 'producto', entidadId: id, detalle: datos.nombre });

  return Response.json({ ok: true, id });
}

/* DELETE /api/productos/[id] */
async function eliminar(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.eliminar');
  const { id } = await params;

  const { data: previo } = await sb.from('productos').select('nombre')
    .eq('empresa_id', perfil.empresa_id).eq('id', id).maybeSingle();
  if (!previo) return error('Producto no encontrado', 404);

  // Los movimientos se conservan: es la trazabilidad del producto.
  const { error: err } = await sb.from('productos').delete()
    .eq('empresa_id', perfil.empresa_id).eq('id', id);
  if (err) return error('No se pudo eliminar: ' + err.message, 500);

  await auditar(sb, perfil, { accion: 'producto.eliminar', entidad: 'producto', entidadId: id, detalle: previo.nombre });
  return Response.json({ ok: true });
}

export const GET = manejar(obtener);
export const PATCH = manejar(actualizar);
export const DELETE = manejar(eliminar);

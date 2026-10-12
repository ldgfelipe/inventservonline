import { error, sesion, exigir, auditar, evento, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/productos?busqueda=&categoria_id=&stock=bajo|agotado&limite= */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');

  const { searchParams } = new URL(request.url);
  const busqueda = (searchParams.get('busqueda') || '').trim();
  const categoria = searchParams.get('categoria_id');
  const stock = searchParams.get('stock');
  const limite = Math.min(Number(searchParams.get('limite')) || 200, 1000);

  let consulta = sb
    .from('productos')
    .select('*, categorias(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .order('id', { ascending: false })
    .limit(limite);

  if (busqueda) {
    // PostgREST interpreta comas y parentesis dentro de or(). Se limpian
    // para que una busqueda como "cemento, arena" no rompa el filtro.
    const termino = busqueda.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (termino) consulta = consulta.or(`nombre.ilike.%${termino}%,codigo.ilike.%${termino}%`);
  }
  if (categoria) consulta = consulta.eq('categoria_id', categoria);
  if (stock === 'bajo') consulta = consulta.gt('stock_actual', 0).lte('stock_minimo', 'stock_actual');
  if (stock === 'agotado') consulta = consulta.lte('stock_actual', 0);

  const { data, error: err } = await consulta;
  if (err) return error('Error consultando productos: ' + err.message, 500);

  const filas = (data || []).map((p) => ({
    ...p,
    categoria_nombre: p.categorias ? p.categorias.nombre : null,
    categorias: undefined,
  }));

  return Response.json({ ok: true, productos: filas, total: filas.length });
}

/* POST /api/productos */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.crear');

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error('Cuerpo JSON invalido');
  }

  const datos = cuerpo.datos || cuerpo;
  if (!datos.nombre || !String(datos.nombre).trim()) return error('El nombre es obligatorio');

  const { data, error: err } = await sb
    .from('productos')
    .insert({
      empresa_id: perfil.empresa_id,
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
    })
    .select('id')
    .single();

  if (err) {
    if (err.code === '23505') return error('Ya existe un producto con ese codigo', 409);
    return error('No se pudo crear: ' + err.message, 500);
  }

  await guardarCampos(sb, perfil.empresa_id, data.id, cuerpo.camposDinamicos || []);
  await auditar(sb, perfil, { accion: 'producto.crear', entidad: 'producto', entidadId: data.id, detalle: datos.nombre });
  await evento(sb, perfil, 'producto.crear');

  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

export async function guardarCampos(sb, empresaId, productoId, campos) {
  for (const c of campos || []) {
    if (c.valor === undefined || c.valor === null || c.valor === '') continue;
    await sb.from('valores_campos').upsert({
      empresa_id: empresaId,
      producto_id: productoId,
      campo_id: c.campo_id,
      valor: String(c.valor),
    }, { onConflict: 'producto_id,campo_id' });
  }
}

export const GET = manejar(listar);
export const POST = manejar(crear);

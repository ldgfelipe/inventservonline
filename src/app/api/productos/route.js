import { error, sesion, exigir, auditar, evento, manejar } from '@/lib/auth';
import { exigirVigencia, revisarLimite } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* Calcula la alerta de stock de un producto.
   Prioridad: agotado > bajo > exceso > por reordenar. */
export function alertaDe(p) {
  const actual = Number(p.stock_actual) || 0;
  const minimo = Number(p.stock_minimo) || 0;
  const maximo = Number(p.stock_maximo) || 0;
  const reorden = Number(p.punto_reorden) || 0;
  if (actual <= 0) return 'agotado';
  if (minimo > 0 && actual <= minimo) return 'bajo';
  if (maximo > 0 && actual > maximo) return 'exceso';
  if (reorden > 0 && actual <= reorden) return 'reorden';
  return 'ok';
}

/* GET /api/productos?busqueda=&categoria_id=&proveedor_id=&stock=bajo|agotado|reorden|exceso&limite= */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');

  const { searchParams } = new URL(request.url);
  const busqueda = (searchParams.get('busqueda') || '').trim();
  const categoria = searchParams.get('categoria_id');
  const proveedor = searchParams.get('proveedor_id');
  const stock = searchParams.get('stock');
  const limite = Math.min(Number(searchParams.get('limite')) || 200, 1000);

  let consulta = sb
    .from('productos')
    .select('*, categorias(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .limit(stock ? 1000 : limite);

  if (busqueda) {
    // PostgREST interpreta comas y parentesis dentro de or(). Se limpian
    // para que una busqueda como "cemento, arena" no rompa el filtro.
    const termino = busqueda.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (termino) consulta = consulta.or(`nombre.ilike.%${termino}%,codigo.ilike.%${termino}%`);
  }
  if (categoria) consulta = consulta.eq('categoria_id', categoria);
  if (proveedor) consulta = consulta.eq('proveedor_id', proveedor);

  const { data, error: err } = await consulta;
  if (err) return error('Error consultando productos: ' + err.message, 500);

  let filas = (data || []).map((p) => ({
    ...p,
    categoria_nombre: p.categorias ? p.categorias.nombre : null,
    categorias: undefined,
    alerta: alertaDe(p),
  }));

  // Las alertas de stock se deciden en el servidor para que el filtro
  // sea consistente entre el panel, el dashboard y la API.
  if (stock) filas = filas.filter((p) => p.alerta === stock);
  if (filas.length > limite) filas = filas.slice(0, limite);

  return Response.json({ ok: true, productos: filas, total: filas.length });
}

/* POST /api/productos */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.crear');

  // Plan: bloquea si la suscripcion vencio y aplica el limite de productos.
  await exigirVigencia(sb, perfil);
  await revisarLimite(sb, perfil, 'productos');

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error('Cuerpo JSON invalido');
  }

  const datos = cuerpo.datos || cuerpo;
  if (!datos.nombre || !String(datos.nombre).trim()) return error('El nombre es obligatorio');

  // Columnas base (existen desde el esquema inicial) y columnas nuevas
  // que llegan con la migracion 010. Si la base aun no la tiene, se
  // reintenta sin ellas para no bloquear la creacion del producto.
  const base = {
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
  };
  const extra = {
    punto_reorden: Number(datos.punto_reorden) || 0,
    costo_promedio: Number(datos.precio_compra) || 0,
    unidad: (datos.unidad || 'unidad').trim() || 'unidad',
    lote: datos.lote || null,
    fecha_vencimiento: datos.fecha_vencimiento || null,
  };

  let { data, error: err } = await sb
    .from('productos')
    .insert({ ...base, ...extra })
    .select('id')
    .single();

  if (err && /column|punto_reorden|unidad|lote|fecha_vencimiento|costo_promedio|schema cache/i.test(err.message)) {
    ({ data, error: err } = await sb.from('productos').insert(base).select('id').single());
  }

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

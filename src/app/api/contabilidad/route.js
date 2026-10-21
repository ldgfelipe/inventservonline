import { error, sesion, exigir, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

function primerDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/* GET /api/contabilidad?desde=&hasta=&producto_id=
   Devuelve el resumen contable del periodo y el kardex valorizado
   (cada movimiento con su costo unitario, costo total y saldo). */
async function consultar(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'contabilidad.ver');
  await exigirModulo(sb, perfil, 'contabilidad');

  const { searchParams } = new URL(request.url);
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = searchParams.get('desde') || primerDiaMes();
  const hasta = searchParams.get('hasta') || hoy;
  const productoId = searchParams.get('producto_id') || null;

  // El resumen se calcula en Postgres (promedio ponderado, valor del
  // inventario, costo de lo vendido y margen).
  const { data: resumen, error: errRes } = await sbRpc.rpc('metricas_contables', {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (errRes) {
    if (/metricas_contables|does not exist|schema cache/i.test(errRes.message)) {
      return error('Falta aplicar la migracion 010 (almacen y contabilidad) en la base de datos.', 503);
    }
    return error('No se pudo calcular el resumen contable: ' + errRes.message, 500);
  }

  let consulta = sb
    .from('movimientos')
    .select('*, productos(nombre, codigo, unidad), proveedores(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .gte('fecha', desde + 'T00:00:00')
    .lte('fecha', hasta + 'T23:59:59.999')
    .order('fecha', { ascending: false })
    .limit(2000);

  if (productoId) consulta = consulta.eq('producto_id', productoId);

  const { data, error: err } = await consulta;
  if (err) return error('No se pudo leer el kardex: ' + err.message, 500);

  // Desglose por categoria (mismo periodo no aplica: es foto del inventario).
  const { data: categorias } = await sbRpc.rpc('contabilidad_por_categoria');

  const kardex = (data || []).map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    producto_id: m.producto_id,
    producto_nombre: m.productos ? m.productos.nombre : null,
    producto_codigo: m.productos ? m.productos.codigo : null,
    producto_unidad: m.productos ? m.productos.unidad : null,
    proveedor_nombre: m.proveedores ? m.proveedores.nombre : null,
    cantidad: m.cantidad,
    precio_unitario: m.precio_unitario,
    total: m.total,
    costo_unitario: m.costo_unitario,
    costo_total: m.costo_total,
    stock_resultante: m.stock_resultante,
    saldo_valor: m.saldo_valor,
    concepto: m.concepto,
    documento: m.documento,
    observacion: m.observacion,
  }));

  return Response.json({ ok: true, desde, hasta, resumen, categorias: categorias || [], kardex });
}

export const GET = manejar(consultar);

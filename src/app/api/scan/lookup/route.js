import { error, sesion, exigir } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/scan/lookup?code=780123...
 *
 * Busca un producto por `codigo` (SKU) escaneado desde QR o barra.
 * Acepta payload JSON de QR impreso:
 *   {"t":"inv","id":123,"code":"780123","name":"...","price":125,"batch":"...","exp":"..."}
 * Si el payload es JSON válido, extrae `code` / `id` y busca en DB.
 *
 * Respuesta:
 *   { ok: true, encontrado: bool, producto: {...}, stock_por_almacen: [...], ultimos_movimientos: [...] }
 *   404 si no existe -> { ok:true, encontrado:false }
 */
async function buscar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');

  const { searchParams } = new URL(request.url);
  let raw = String(searchParams.get('code') || '').trim();
  if (!raw) return error('Falta el parámetro code', 400);

  let codigoLimpio = raw;
  let idFromQr = null;
  let priceFromQr = null;
  let batchFromQr = null;
  let expFromQr = null;

  // Intentar parsear JSON de QR
  try {
    if (raw.startsWith('{')) {
      const j = JSON.parse(raw);
      if (j.code) codigoLimpio = String(j.code).trim();
      if (j.id) idFromQr = Number(j.id) || null;
      if (j.price !== undefined) priceFromQr = Number(j.price);
      if (j.batch) batchFromQr = String(j.batch);
      if (j.exp) expFromQr = String(j.exp);
    }
  } catch { /* es código plano */ }

  // 1) Buscar por id si vino en el QR
  let producto = null;
  if (idFromQr) {
    const { data } = await sb
      .from('productos')
      .select('*')
      .eq('id', idFromQr)
      .eq('empresa_id', perfil.empresa_id)
      .maybeSingle();
    if (data) producto = data;
  }

  // 2) Buscar por codigo
  if (!producto && codigoLimpio) {
    const { data } = await sb
      .from('productos')
      .select('*')
      .eq('empresa_id', perfil.empresa_id)
      .eq('codigo', codigoLimpio)
      .maybeSingle();
    if (data) producto = data;
  }

  // 3) Fallback: codigo como ilike suave (por si el scanner leyó con espacios)
  if (!producto && codigoLimpio) {
    const term = codigoLimpio.replace(/[^0-9A-Za-z-]/g, '');
    if (term) {
      const { data } = await sb
        .from('productos')
        .select('*')
        .eq('empresa_id', perfil.empresa_id)
        .ilike('codigo', `%${term}%`)
        .limit(1)
        .maybeSingle();
      if (data) producto = data;
    }
  }

  if (!producto) {
    return Response.json({
      ok: true,
      encontrado: false,
      code: codigoLimpio,
      id: idFromQr,
      price_from_qr: priceFromQr,
      batch_from_qr: batchFromQr,
      exp_from_qr: expFromQr,
    });
  }

  // Stock por almacén (si existe tabla stock_almacen)
  let stockPorAlmacen = [];
  try {
    const { data } = await sb
      .from('stock_almacen')
      .select('cantidad, almacenes(nombre)')
      .eq('empresa_id', perfil.empresa_id)
      .eq('producto_id', producto.id);
    if (data) {
      stockPorAlmacen = data.map((s) => ({
        cantidad: Number(s.cantidad) || 0,
        almacen: s.almacenes ? s.almacenes.nombre : '—',
      }));
    }
  } catch { /* tabla opcional */ }

  // Últimos movimientos
  let ultimosMovimientos = [];
  try {
    const { data } = await sb
      .from('movimientos')
      .select('tipo, cantidad, fecha, usuario, observacion, almacen_id')
      .eq('empresa_id', perfil.empresa_id)
      .eq('producto_id', producto.id)
      .order('fecha', { ascending: false })
      .limit(10);
    if (data) ultimosMovimientos = data;
  } catch { /* tabla opcional */ }

  return Response.json({
    ok: true,
    encontrado: true,
    producto: {
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      stock_actual: Number(producto.stock_actual) || 0,
      precio_compra: Number(producto.precio_compra) || 0,
      precio_venta: Number(producto.precio_venta) || 0,
      unidad: producto.unidad || 'unidad',
      ubicacion: producto.ubicacion || null,
      categoria_id: producto.categoria_id || null,
      proveedor_id: producto.proveedor_id || null,
    },
    stock_por_almacen: stockPorAlmacen,
    ultimos_movimientos: ultimosMovimientos,
    price_from_qr: priceFromQr,
    batch_from_qr: batchFromQr,
    exp_from_qr: expFromQr,
  });
}

export const GET = buscar;

import { error, sesion, exigir, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/reportes/ventas?desde=&hasta= -> ventas con margen */
async function ventas(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'reportes.ver');
  await exigirModulo(sb, perfil, 'reportes_basicos');
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  let q = sb.from('ventas')
    .select('id, numero, fecha, total, subtotal, descuento, impuesto, estado, clientes(nombre)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(500);
  if (desde) q = q.gte('fecha', desde + 'T00:00:00');
  if (hasta) q = q.lte('fecha', hasta + 'T23:59:59');
  const { data: ventas, error: err } = await q;
  if (err) return error(err.message, 500);

  const ids = (ventas || []).map((v) => v.id);
  let costos = {};
  if (ids.length) {
    const { data: det } = await sb.from('venta_detalle')
      .select('venta_id, cantidad, costo_unitario').in('venta_id', ids);
    for (const d of det || []) {
      costos[d.venta_id] = (costos[d.venta_id] || 0) + (Number(d.cantidad) * Number(d.costo_unitario));
    }
  }

  const filas = (ventas || []).map((v) => {
    const costo = costos[v.id] || 0;
    const margen = Number(v.total) - costo;
    const margenPct = Number(v.total) > 0 ? (margen / Number(v.total)) * 100 : 0;
    return {
      id: v.id,
      numero: v.numero,
      fecha: v.fecha,
      cliente: v.clientes ? v.clientes.nombre : null,
      total: v.total,
      costo: round2(costo),
      margen: round2(margen),
      margen_pct: round2(margenPct),
      estado: v.estado,
    };
  });

  const totales = {
    ventas: filas.length,
    total: round2(filas.reduce((a, f) => a + Number(f.total), 0)),
    costo: round2(filas.reduce((a, f) => a + Number(f.costo), 0)),
    margen: round2(filas.reduce((a, f) => a + Number(f.margen), 0)),
  };
  return Response.json({ ok: true, filas, totales });
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

export const GET = manejar(ventas);

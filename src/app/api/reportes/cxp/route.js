import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function diasDesde(fecha) {
  if (!fecha) return 0;
  const d = new Date(fecha);
  const hoy = new Date();
  return Math.floor((hoy - d) / (1000 * 60 * 60 * 24));
}

/* GET /api/reportes/cxp -> antiguedad de CxP */
async function cxp(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'reportes.ver');
  const { data, error: err } = await sb.from('cuentas_por_pagar')
    .select('id, saldo, estado, created_at, fecha_vencimiento, proveedores(nombre)')
    .eq('empresa_id', perfil.empresa_id);
  if (err) {
    if (/cuentas_por_pagar|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, filas: [], resumen: {} });
    return error(err.message, 500);
  }
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const filas = (data || []).map((c) => {
    const dias = diasDesde(c.fecha_vencimiento || c.created_at);
    const bucket = dias <= 30 ? '0-30' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '90+';
    buckets[bucket] += Number(c.saldo) || 0;
    return {
      id: c.id,
      proveedor: c.proveedores ? c.proveedores.nombre : null,
      saldo: c.saldo,
      estado: c.estado,
      dias,
      bucket,
    };
  });
  const total = filas.reduce((a, f) => a + (Number(f.saldo) || 0), 0);
  return Response.json({ ok: true, filas, resumen: { ...buckets, total: round2(total) } });
}

export const GET = manejar(cxp);

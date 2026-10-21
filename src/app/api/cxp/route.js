import { error, sesion, exigir, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/cxp -> cuentas por pagar */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'cxp.ver');
  await exigirModulo(sb, perfil, 'cxp');
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');
  let q = sb.from('cuentas_por_pagar')
    .select('*, proveedores(nombre), compras(numero, fecha, total)')
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error: err } = await q;
  if (err) {
    if (/cuentas_por_pagar|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, cxp: [] });
    return error(err.message, 500);
  }
  const cxp = (data || []).map((c) => ({
    ...c,
    proveedor_nombre: c.proveedores ? c.proveedores.nombre : null,
    compra_numero: c.compras ? c.compras.numero : null,
    proveedores: undefined, compras: undefined,
  }));
  return Response.json({ ok: true, cxp });
}

export const GET = manejar(listar);

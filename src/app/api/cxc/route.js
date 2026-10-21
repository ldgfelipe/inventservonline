import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/cxc -> cuentas por cobrar de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'cxc.ver');
  await exigirModulo(sb, perfil, 'cxc');
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');
  let q = sb.from('cuentas_por_cobrar')
    .select('*, clientes(nombre), ventas(numero, fecha, total)')
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error: err } = await q;
  if (err) {
    if (/cuentas_por_cobrar|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, cxc: [] });
    return error(err.message, 500);
  }
  const cxc = (data || []).map((c) => ({
    ...c,
    cliente_nombre: c.clientes ? c.clientes.nombre : null,
    venta_numero: c.ventas ? c.ventas.numero : null,
    clientes: undefined, ventas: undefined,
  }));
  return Response.json({ ok: true, cxc });
}

export const GET = manejar(listar);

import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { exigirModulo } from '@/lib/licenciamiento';

export const runtime = 'nodejs';

/* GET /api/cobros -> cobros de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'caja.ver');
  const { searchParams } = new URL(request.url);
  const limite = Math.min(Number(searchParams.get('limite')) || 200, 1000);
  const { data, error: err } = await sb.from('cobros')
    .select('*, clientes(nombre), ventas(numero)')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(limite);
  if (err) {
    if (/cobros|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, cobros: [] });
    return error(err.message, 500);
  }
  const cobros = (data || []).map((c) => ({
    ...c,
    cliente_nombre: c.clientes ? c.clientes.nombre : null,
    venta_numero: c.ventas ? c.ventas.numero : null,
    clientes: undefined, ventas: undefined,
  }));
  return Response.json({ ok: true, cobros });
}

/* POST /api/cobros { cliente_id, venta_id?, monto, metodo?, referencia? } */
async function crear(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  exigir(perfil, 'cobros.registrar');
  await exigirModulo(sb, perfil, 'pos');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const monto = Number(cuerpo.monto);
  if (!monto || monto <= 0) return error('El monto debe ser mayor a cero');
  if (!cuerpo.cliente_id) return error('Falta el cliente');

  try {
    const { data, error: err } = await sbRpc.rpc('registrar_cobro', {
      p_cliente: cuerpo.cliente_id,
      p_venta: cuerpo.venta_id || null,
      p_monto: monto,
      p_metodo: cuerpo.metodo || 'efectivo',
      p_referencia: cuerpo.referencia || null,
    });
    if (err) return error(err.message, 400);
    await auditar(sb, perfil, { accion: 'cobro.registrar', entidad: 'cobro', entidadId: data.cobro_id, detalle: `monto ${monto}` });
    return Response.json({ ok: true, ...data }, { status: 201 });
  } catch (e) {
    return error(e.message || 'Error al registrar el cobro', 400);
  }
}

export const GET = manejar(listar);
export const POST = manejar(crear);

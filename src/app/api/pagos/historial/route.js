import { sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/pagos/historial -> pagos de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  const { data, error: err } = await sb.from('pagos_saas_historial')
    .select('id, plan, monto, moneda, pasarela, estado, periodo_desde, periodo_hasta, comprobante_url, referencia_externa, nota, created_at, aprobado_at')
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (err) {
    // Si falta la migracion 013 devolvemos vacio para no romper la vista.
    if (/relation|does not exist|schema cache|Could not find the table/i.test(err.message)) {
      return Response.json({ ok: true, pagos: [] });
    }
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
  return Response.json({ ok: true, pagos: data || [] });
}

export const GET = manejar(listar);

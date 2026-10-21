import { error, sesion, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/conversiones -> lista (super-admin o propia empresa) */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  const { searchParams } = new URL(request.url);
  const campanaId = searchParams.get('campana_id');
  let q = sb.from('conversiones').select('*').order('created_at', { ascending: false }).limit(200);
  if (!perfil.super_admin) q = q.eq('empresa_id', perfil.empresa_id);
  if (campanaId) q = q.eq('campana_id', campanaId);
  const { data, error: err } = await q;
  if (err) {
    if (/conversiones|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, conversiones: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, conversiones: data || [] });
}

/* POST /api/conversiones { empresa_id?, campana_id?, tipo, valor?, moneda?, plan?, metodo_pago?, notas? } */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const empresaId = cuerpo.empresa_id || perfil.empresa_id;
  const tipo = String(cuerpo.tipo || 'registro').trim();
  const { data, error: err } = await sb.from('conversiones').insert({
    empresa_id: empresaId,
    campana_id: cuerpo.campana_id || null,
    tipo,
    valor: Number(cuerpo.valor) || 0,
    moneda: cuerpo.moneda || 'USD',
    plan: cuerpo.plan || null,
    metodo_pago: cuerpo.metodo_pago || null,
    notas: cuerpo.notas || null,
  }).select('id').single();
  if (err) return error('No se pudo registrar: ' + err.message, 500);
  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(crear);

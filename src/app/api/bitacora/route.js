import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/bitacora -> registro auditable de la empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'bitacora.ver');

  const { searchParams } = new URL(request.url);
  const usuario = (searchParams.get('usuario') || '').trim();
  const area = searchParams.get('area');
  const accion = searchParams.get('accion');
  const limite = Math.min(Number(searchParams.get('limite')) || 400, 2000);

  let consulta = sb.from('bitacora').select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })
    .limit(limite);

  if (area) consulta = consulta.eq('area', area);
  if (accion) consulta = consulta.eq('accion', accion);
  if (usuario) consulta = consulta.ilike('usuario', `%${usuario}%`);

  const { data, error: err } = await consulta;
  if (err) return error('Error consultando la bitacora: ' + err.message, 500);

  return Response.json({ ok: true, bitacora: data || [], total: (data || []).length });
}

export const GET = manejar(listar);

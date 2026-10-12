import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/config -> giro actual y datos de la empresa */
async function leer(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  const { data: emp } = await sb.from('empresas').select('giro_actual, nombre, plan')
    .eq('id', perfil.empresa_id).maybeSingle();

  const { data: conf } = await sb.from('configuracion')
    .select('clave, valor').eq('empresa_id', perfil.empresa_id);

  const mapa = {};
  for (const c of conf || []) mapa[c.clave] = c.valor;

  return Response.json({
    ok: true,
    giro_actual: emp ? emp.giro_actual : null,
    empresa: emp ? emp.nombre : null,
    plan: emp ? emp.plan : null,
    config: mapa,
  });
}

export const GET = manejar(leer);

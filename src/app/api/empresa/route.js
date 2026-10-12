import { error, sesion, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/empresa -> datos basicos de la empresa del usuario.
   Cualquier usuario autenticado puede leerla (no es informacion sensible
   de otras empresas) porque la necesita para saber su giro activo. */
async function leer(request) {
  const { perfil, sb } = await sesion(request);
  const { data, error: err } = await sb.from('empresas')
    .select('nombre, rif, giro_actual, plan')
    .eq('id', perfil.empresa_id)
    .maybeSingle();
  if (err) return error(err.message, 500);
  return Response.json({ ok: true, empresa: data });
}

export const GET = manejar(leer);

import { error, sesion, exigir, manejar } from '@/lib/auth';
import { PERMISOS, ROLES, AREAS } from '@/services/permisos';

export const runtime = 'nodejs';

/* GET /api/catalogos -> roles, areas y permisos (panel de usuarios) */
async function catalogos(request) {
  const { perfil } = await sesion(request);
  exigir(perfil, 'usuarios.gestionar');

  return Response.json({
    ok: true,
    roles: Object.entries(ROLES).map(([clave, v]) => ({ clave, ...v })),
    areas: AREAS,
    permisos: PERMISOS,
  });
}

export const GET = manejar(catalogos);

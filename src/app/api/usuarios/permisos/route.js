import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { permisosDeRol } from '@/services/permisos';

export const runtime = 'nodejs';

/* GET /api/usuarios/permisos?rol= */
async function leer(request) {
  const { perfil } = await sesion(request);
  exigir(perfil, 'usuarios.gestionar');
  const rol = new URL(request.url).searchParams.get('rol') || '';
  return Response.json({ ok: true, permisos: permisosDeRol(rol) });
}

export const GET = manejar(leer);

import { error, sesion, usuarioPublico, NoAutorizado } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/auth/sesion -> perfil del usuario autenticado.
   Devuelve la forma completa que espera el renderer, incluidos
   `permisos`, `rolNombre` y `nivel`. */
export async function GET(request) {
  try {
    const { perfil } = await sesion(request);
    return Response.json({ ok: true, usuario: usuarioPublico(perfil) });
  } catch (err) {
    return error(err.message, err instanceof NoAutorizado ? 401 : 500);
  }
}

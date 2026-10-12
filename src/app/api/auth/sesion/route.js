import { error, sesion, NoAutorizado } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/auth/sesion -> perfil del usuario autenticado */
export async function GET(request) {
  try {
    const { perfil } = await sesion(request);
    return Response.json({
      ok: true,
      usuario: {
        id: perfil.id,
        nombre: perfil.nombre,
        rol: perfil.rol,
        area: perfil.area,
        empresa_id: perfil.empresa_id,
      },
    });
  } catch (err) {
    return error(err.message, err instanceof NoAutorizado ? 401 : 500);
  }
}

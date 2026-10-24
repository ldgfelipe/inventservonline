import { conJwt, admin } from '@/lib/supabase';
import { error } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/auth/refresh { refresh_token }
   Renueva la sesion sin pedir la contrasena. Se usa cuando el
   access_token expira (Supabase lo emite por ~1 hora) para que la
   sesion dure hasta que el usuario cierre sesion o sea bloqueado. */
export async function POST(request) {
  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const refreshToken = String(cuerpo.refresh_token || '').trim();
  if (!refreshToken) return error('Falta refresh_token', 401);

  const { data, error: err } = await conJwt().auth.refreshSession({ refresh_token: refreshToken });
  if (err || !data?.session) {
    return error('Sesion expirada. Vuelve a iniciar sesion.', 401);
  }

  // Si el usuario fue bloqueado, no se renueva la sesion.
  try {
    const sb = admin();
    const { data: perfil } = await sb.from('perfiles')
      .select('activo').eq('id', data.user.id).maybeSingle();
    if (perfil && perfil.activo === false) {
      return error('Tu cuenta esta bloqueada. Contacta al administrador.', 403);
    }
  } catch { /* si la consulta falla, no impedir la renovacion */ }

  const respuesta = Response.json({
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token || refreshToken,
    expires_at: data.session.expires_at,
  });
  respuesta.headers.append(
    'Set-Cookie',
    `invetser_token=${data.session.access_token}; Path=/; Max-Age=31536000; SameSite=Lax`
  );
  return respuesta;
}

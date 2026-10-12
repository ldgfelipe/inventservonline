import { conJwt } from '@/lib/supabase';
import { error } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/auth/login  { email, password } -> tokens de sesion */
export async function POST(request) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error('Cuerpo JSON invalido');
  }

  const email = String(cuerpo.email || '').trim().toLowerCase();
  const password = String(cuerpo.password || '');
  if (!email || !password) return error('Email y contrasena son requeridos');

  const { data, error: err } = await conJwt().auth.signInWithPassword({ email, password });
  if (err || !data?.session) {
    return error('Email o contrasena incorrectos', 401);
  }

  const sb = conJwt(data.session.access_token);
  const { data: perfil } = await sb.from('perfiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!perfil) return error('La cuenta no tiene empresa asignada', 403);
  if (!perfil.activo) return error('El usuario esta inactivo', 403);

  return Response.json({
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    usuario: publico(perfil, email),
  });
}

function publico(perfil, email) {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    rol: perfil.rol,
    area: perfil.area,
    empresa_id: perfil.empresa_id,
    email,
  };
}

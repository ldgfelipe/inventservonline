import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* POST /api/usuarios/[id]/clave  { password } -> restablece la contrasena */
async function cambiar(request, { params }) {
  const { perfil } = await sesion(request);
  exigir(perfil, 'usuarios.gestionar');
  const { id } = await params;

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  if (!cuerpo.password || cuerpo.password.length < 6) {
    return error('La contrasena debe tener al menos 6 caracteres');
  }

  const sbAdmin = admin();

  // El usuario debe pertenecer a mi empresa
  const { data: objetivo } = await sbAdmin.from('perfiles')
    .select('id, nombre').eq('empresa_id', perfil.empresa_id).eq('id', id).maybeSingle();
  if (!objetivo) return error('Usuario no encontrado', 404);

  const { error: err } = await sbAdmin.auth.admin.updateUserById(id, { password: cuerpo.password });
  if (err) return error('No se pudo cambiar la contrasena: ' + err.message, 500);

  try {
    await sbAdmin.from('bitacora').insert({
      empresa_id: perfil.empresa_id,
      usuario_id: perfil.id,
      usuario: perfil.nombre,
      area: perfil.area,
      rol: perfil.rol,
      accion: 'usuario.resetClave',
      entidad: 'usuario',
      entidad_id: id,
      detalle: objetivo.nombre,
    });
  } catch { /* auditoria best-effort */ }

  return Response.json({ ok: true });
}

export const POST = manejar(cambiar);

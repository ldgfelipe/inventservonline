import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/perfil -> datos del perfil propio */
async function leer(request) {
  const { perfil, usuario, sb } = await sesion(request);
  return Response.json({
    ok: true,
    perfil: {
      id: perfil.id,
      nombre: perfil.nombre,
      email: usuario.email,
      rol: perfil.rol,
      area: perfil.area,
      super_admin: !!perfil.super_admin,
    },
  });
}

/* PATCH /api/perfil { nombre?, email?, password? } -> editar perfil propio */
async function actualizar(request) {
  const { perfil, usuario, sb } = await sesion(request);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const cambiosPerfil = {};
  const cambiosAuth = {};

  if (cuerpo.nombre !== undefined) {
    const nombre = String(cuerpo.nombre).trim();
    if (!nombre) return error('El nombre no puede quedar vacio');
    cambiosPerfil.nombre = nombre;
  }
  if (cuerpo.email !== undefined) {
    const email = String(cuerpo.email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('Email invalido');
    if (email !== usuario.email) cambiosAuth.email = email;
  }
  if (cuerpo.password) {
    if (String(cuerpo.password).length < 6) return error('La contrasena debe tener al menos 6 caracteres');
    cambiosAuth.password = String(cuerpo.password);
  }

  if (Object.keys(cambiosPerfil).length) {
    const { error: err } = await sb.from('perfiles').update(cambiosPerfil).eq('id', perfil.id);
    if (err) return error('No se pudo actualizar el perfil: ' + err.message, 500);
  }

  if (Object.keys(cambiosAuth).length) {
    const sbAdmin = admin();
    const { error: err } = await sbAdmin.auth.admin.updateUserById(usuario.id, cambiosAuth);
    if (err) {
      if (/already|exists|registered/i.test(err.message)) return error('Ese email ya esta registrado', 409);
      return error('No se pudo actualizar el acceso: ' + err.message, 500);
    }
  }

  return Response.json({ ok: true });
}

export const GET = manejar(leer);
export const PATCH = manejar(actualizar);

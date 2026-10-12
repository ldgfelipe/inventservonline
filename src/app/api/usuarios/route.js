import { NextRequest } from 'next/server';
import { admin, conJwt } from '@/lib/supabase';
import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { rolValido, areaValida } from '@/services/permisos';
import { hashearPassword } from '@/services/seguridad';

export const runtime = 'nodejs';

/* GET /api/usuarios -> usuarios de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'usuarios.gestionar');

  const { data, error: err } = await sb.from('perfiles')
    .select('id, nombre, rol, area, activo, created_at')
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at');
  if (err) return error(err.message, 500);

  // El email vive en auth.users; se consulta con service_role
  const sbAdmin = admin();
  const usuarios = [];
  for (const p of data || []) {
    const { data: u } = await sbAdmin.auth.admin.getUserById(p.id);
    usuarios.push({ ...p, usuario: u && u.user ? u.user.email : null });
  }

  return Response.json({ ok: true, usuarios });
}

/* POST /api/usuarios -> crea o actualiza un usuario de mi empresa */
async function guardar(request) {
  const { perfil } = await sesion(request);
  exigir(perfil, 'usuarios.gestionar');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const nombre = String(cuerpo.nombre || '').trim();
  const email = String(cuerpo.usuario || '').trim().toLowerCase();
  const rol = cuerpo.rol;
  const area = cuerpo.area;

  if (!nombre) return error('El nombre es obligatorio');
  if (!email) return error('El email es obligatorio');
  if (!rolValido(rol)) return error('Rol invalido');
  if (!areaValida(area)) return error('Area invalida');

  const sbAdmin = admin();

  if (cuerpo.id) {
    // Actualizar perfil existente
    const { data: otro } = await sbAdmin.from('perfiles')
      .select('id').eq('empresa_id', perfil.empresa_id).eq('nombre', nombre).neq('id', cuerpo.id).maybeSingle();
    if (otro) return error('Ya hay otro usuario con ese nombre', 409);

    const { error: err } = await sbAdmin.from('perfiles')
      .update({ nombre, rol, area, activo: cuerpo.activo !== false })
      .eq('empresa_id', perfil.empresa_id).eq('id', cuerpo.id);
    if (err) return error('No se pudo actualizar: ' + err.message, 500);

    if (cuerpo.password) {
      const { error: errPass } = await sbAdmin.auth.admin.updateUserById(cuerpo.id, { password: cuerpo.password });
      if (errPass) return error('No se pudo cambiar la contrasena: ' + errPass.message, 500);
    }

    await auditarAdmin(sbAdmin, perfil, 'usuario.guardar', cuerpo.id, `${nombre} rol=${rol}`);
    return Response.json({ ok: true, id: cuerpo.id });
  }

  // Crear: usuario de auth + perfil en la misma empresa
  if (!cuerpo.password || cuerpo.password.length < 6) {
    return error('La contrasena debe tener al menos 6 caracteres');
  }

  const { data: creado, error: errUser } = await sbAdmin.auth.admin.createUser({
    email,
    password: cuerpo.password,
    email_confirm: true,
  });
  if (errUser || !creado?.user) {
    const msg = errUser?.message || '';
    if (/already|exists|registered/i.test(msg)) return error('Ese email ya esta registrado', 409);
    return error('No se pudo crear el usuario: ' + msg, 500);
  }

  const { error: errPerfil } = await sbAdmin.from('perfiles').insert({
    id: creado.user.id,
    empresa_id: perfil.empresa_id,
    nombre,
    rol,
    area,
  });
  if (errPerfil) {
    await sbAdmin.auth.admin.deleteUser(creado.user.id).catch(() => {});
    return error('No se pudo crear el perfil: ' + errPerfil.message, 500);
  }

  await auditarAdmin(sbAdmin, perfil, 'usuario.crear', creado.user.id, `${nombre} (${email}) rol=${rol} area=${area}`);
  return Response.json({ ok: true, id: creado.user.id }, { status: 201 });
}

/* DELETE /api/usuarios?id= */
async function eliminar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'usuarios.gestionar');

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error('Falta el id');
  if (id === perfil.id) return error('No puedes eliminar tu propio usuario');

  const { count } = await sb.from('perfiles')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', perfil.empresa_id).eq('activo', true);
  if ((count || 0) <= 1) return error('Debe existir al menos un usuario activo');

  const { error: err } = await sb.from('perfiles').delete().eq('empresa_id', perfil.empresa_id).eq('id', id);
  if (err) return error('No se pudo eliminar: ' + err.message, 500);

  await admin().auth.admin.deleteUser(id).catch(() => {});
  await auditar(sb, perfil, { accion: 'usuario.eliminar', entidad: 'usuario', entidadId: id });
  return Response.json({ ok: true });
}

async function auditarAdmin(sbAdmin, perfil, accion, entidadId, detalle) {
  try {
    await sbAdmin.from('bitacora').insert({
      empresa_id: perfil.empresa_id,
      usuario_id: perfil.id,
      usuario: perfil.nombre,
      area: perfil.area,
      rol: perfil.rol,
      accion,
      entidad: 'usuario',
      entidad_id: entidadId,
      detalle,
    });
  } catch { /* la auditoria nunca rompe la operacion */ }
}

export const GET = manejar(listar);
export const POST = manejar(guardar);
export const DELETE = manejar(eliminar);

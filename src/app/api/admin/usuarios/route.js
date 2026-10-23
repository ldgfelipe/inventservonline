import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* Cuenta filas por empresa en bloque. */
async function contarPorEmpresa(sb, tabla, extra = {}) {
  let q = sb.from(tabla).select('empresa_id');
  for (const [k, v] of Object.entries(extra)) q = q.eq(k, v);
  const { data } = await q;
  const mapa = {};
  for (const r of data || []) {
    if (!r.empresa_id) continue;
    mapa[r.empresa_id] = (mapa[r.empresa_id] || 0) + 1;
  }
  return mapa;
}

/* GET /api/admin/usuarios -> todos los usuarios de la plataforma */
async function listar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sb = admin();
  const [{ data: perfiles, error: err }, { data: empresas }] = await Promise.all([
    sb.from('perfiles').select('id, nombre, empresa_id, rol, area, activo, super_admin, created_at').order('created_at', { ascending: false }),
    sb.from('empresas').select('id, nombre, email, plan'),
  ]);
  if (err) return error(err.message, 500);

  const empMap = {};
  for (const e of empresas || []) empMap[e.id] = e;

  // Emails desde auth.users
  const emailMap = {};
  try {
    const { data: lista } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of (lista && lista.users) || []) emailMap[u.id] = u.email;
  } catch { /* opcional */ }

  const [productos, movimientos, ventas, archivos] = await Promise.all([
    contarPorEmpresa(sb, 'productos', { activo: true }),
    contarPorEmpresa(sb, 'movimientos'),
    contarPorEmpresa(sb, 'ventas'),
    contarPorEmpresa(sb, 'producto_adjuntos'),
  ]);

  const usuarios = (perfiles || []).map((p) => {
    const e = empMap[p.empresa_id];
    return {
      id: p.id,
      nombre: p.nombre,
      email: emailMap[p.id] || null,
      rol: p.rol,
      area: p.area,
      activo: p.activo,
      super_admin: p.super_admin,
      empresa_id: p.empresa_id,
      empresa: e ? e.nombre : null,
      plan: e ? e.plan : null,
      productos: productos[p.empresa_id] || 0,
      movimientos: movimientos[p.empresa_id] || 0,
      ventas: ventas[p.empresa_id] || 0,
      archivos: archivos[p.empresa_id] || 0,
      created_at: p.created_at,
    };
  });

  return Response.json({ ok: true, usuarios });
}

/* POST /api/admin/usuarios { nombre, email, password, rol, area, empresa_id?, super_admin? } */
async function crear(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const nombre = String(cuerpo.nombre || '').trim();
  const email = String(cuerpo.email || '').trim().toLowerCase();
  const password = String(cuerpo.password || '');
  const rol = String(cuerpo.rol || 'admin').trim();
  const area = String(cuerpo.area || 'Administracion').trim();
  const superAdmin = cuerpo.super_admin === true;
  let empresaId = cuerpo.empresa_id || null;

  if (!nombre) return error('El nombre es obligatorio');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('Email invalido');
  if (password.length < 6) return error('La contrasena debe tener al menos 6 caracteres');
  if (!['admin', 'supervisor', 'almacenista', 'consultor'].includes(rol)) return error('Rol invalido');

  const sb = admin();

  // Si es super-admin sin empresa, usar/crear la empresa de administracion.
  if (!empresaId) {
    const { data: empAdmin } = await sb.from('empresas').select('id').eq('email', 'admin@inventseronline.local').maybeSingle();
    if (empAdmin) empresaId = empAdmin.id;
    else {
      const { data: nueva, error: errEmp } = await sb.from('empresas').insert({
        nombre: 'Administracion de la plataforma',
        email: 'admin@inventseronline.local',
        giro_actual: 'Servicios profesionales',
        plan: 'empresa',
      }).select('id').single();
      if (errEmp) return error('No se pudo crear la empresa base: ' + errEmp.message, 500);
      empresaId = nueva.id;
    }
  }

  const { data: creado, error: errUser } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errUser || !creado?.user) {
    if (/already|exists|registered/i.test(errUser?.message || '')) return error('Ese email ya esta registrado', 409);
    return error('No se pudo crear el usuario: ' + (errUser?.message || ''), 500);
  }

  const { error: errPerfil } = await sb.from('perfiles').insert({
    id: creado.user.id,
    empresa_id: empresaId,
    nombre,
    rol,
    area,
    super_admin: superAdmin,
    activo: true,
  });
  if (errPerfil) {
    await sb.auth.admin.deleteUser(creado.user.id).catch(() => {});
    return error('No se pudo crear el perfil: ' + errPerfil.message, 500);
  }

  return Response.json({ ok: true, id: creado.user.id }, { status: 201 });
}

/* PATCH /api/admin/usuarios { id, activo?, motivo?, rol?, area?, super_admin?, password? } */
async function actualizar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const id = String(cuerpo.id || '').trim();
  if (!id) return error('Falta el id');

  // Evitar que el super-admin se bloquee a si mismo
  if (id === perfil.id && cuerpo.activo === false) return error('No puedes bloquearte a ti mismo');

  const sb = admin();

  // Leer el perfil objetivo (para el log y para saber su empresa)
  const { data: objetivo } = await sb.from('perfiles').select('id, empresa_id, activo, nombre').eq('id', id).maybeSingle();
  if (!objetivo) return error('Usuario no encontrado', 404);

  const cambiosPerfil = {};
  if (cuerpo.activo !== undefined) cambiosPerfil.activo = cuerpo.activo === true;
  if (cuerpo.rol !== undefined) cambiosPerfil.rol = String(cuerpo.rol);
  if (cuerpo.area !== undefined) cambiosPerfil.area = String(cuerpo.area);
  if (cuerpo.super_admin !== undefined) cambiosPerfil.super_admin = cuerpo.super_admin === true;

  if (Object.keys(cambiosPerfil).length) {
    const { error: err } = await sb.from('perfiles').update(cambiosPerfil).eq('id', id);
    if (err) return error('No se pudo actualizar: ' + err.message, 500);
  }

  if (cuerpo.password) {
    if (String(cuerpo.password).length < 6) return error('La contrasena debe tener al menos 6 caracteres');
    const { error: errPass } = await sb.auth.admin.updateUserById(id, { password: String(cuerpo.password) });
    if (errPass) return error('No se pudo cambiar la contrasena: ' + errPass.message, 500);
  }

  // Bloquear/desbloquear en Supabase Auth (ban) para cortar el acceso de inmediato
  if (cuerpo.activo !== undefined) {
    try {
      await sb.auth.admin.updateUserById(id, { ban_duration: cuerpo.activo === false ? '876000h' : 'none' });
    } catch { /* opcional */ }

    // Registrar en el historial de bloqueos (best-effort)
    const accion = cuerpo.activo === false ? 'bloqueo' : 'desbloqueo';
    try {
      await sb.from('usuarios_bloqueos').insert({
        usuario_id: id,
        empresa_id: objetivo.empresa_id || null,
        accion,
        motivo: cuerpo.motivo || null,
        realizado_por: perfil.id,
        realizado_por_nombre: perfil.nombre || null,
      });
    } catch { /* si falta la migracion 034, no rompe la operacion */ }
  }

  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(crear);
export const PATCH = manejar(actualizar);

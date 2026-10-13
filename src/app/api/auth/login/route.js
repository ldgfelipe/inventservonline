import { conJwt, admin } from '@/lib/supabase';
import { error } from '@/lib/auth';

export const runtime = 'nodejs';

/* ============================================================
   POST /api/auth/login

   Antes devolvia "La cuenta no tiene empresa asignada" para dos
   fallos distintos (perfil inexistente vs. RLS bloqueando la lectura),
   lo que hacia imposible diagnosticarlo desde fuera. Ahora:

   1. Intenta leer el perfil con el token del usuario (RLS aplica)
   2. Si no aparece, lo verifica con service_role (salta RLS) para
      saber si el problema es la fila o la politica
   3. Si la fila realmente falta, AUTO-REPARA: enlaza el usuario con
      la empresa que se quedo huerfana de un intento fallido, o crea
      una nueva. Asi la cuenta queda usable sin SQL manual.
   ============================================================ */

async function reparar(sbAdmin, usuarioId, email) {
  // Empresa huerfana: existe pero ningun perfil apunta a ella.
  // Se buscan en orden y se toma la primera que este realmente libre.
  const { data: empresas } = await sbAdmin.from('empresas')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(10);

  let empresaId = null;
  for (const e of empresas || []) {
    const { data: perfiles } = await sbAdmin.from('perfiles')
      .select('id').eq('empresa_id', e.id).limit(1);
    if (!perfiles || perfiles.length === 0) { empresaId = e.id; break; }
  }

  if (!empresaId) {
    const { data: nueva, error: errEmp } = await sbAdmin.from('empresas')
      .insert({ nombre: 'Mi empresa', email, giro_actual: 'Otro', plan: 'trial' })
      .select('id').single();
    if (errEmp) throw new Error('No se pudo crear la empresa: ' + errEmp.message);
    empresaId = nueva.id;

    const { data: cat } = await sbAdmin.from('categorias')
      .select('id').eq('empresa_id', empresaId).limit(1);
    if (!cat || cat.length === 0) {
      await sbAdmin.from('categorias').insert({ empresa_id: empresaId, nombre: 'General' });
    }
  }

  const { error: errPerfil } = await sbAdmin.from('perfiles').insert({
    id: usuarioId,
    empresa_id: empresaId,
    nombre: email.split('@')[0],
    rol: 'admin',
    area: 'Administracion',
  });
  if (errPerfil) throw new Error('No se pudo crear el perfil: ' + errPerfil.message);

  return empresaId;
}

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

  const usuarioId = data.user.id;
  const token = data.session.access_token;

  // 1) Lectura con RLS
  let sb = conJwt(token);
  let { data: perfil, error: errPerfil } = await sb.from('perfiles')
    .select('*').eq('id', usuarioId).maybeSingle();

  // 2) Si RLS lo bloqueo o la fila falta: verdad absoluta con service_role
  if (!perfil) {
    const sbAdmin = admin();
    const { data: perfilReal, error: errReal } = await sbAdmin.from('perfiles')
      .select('*').eq('id', usuarioId).maybeSingle();

    if (errReal) {
      return error('La base de datos rechazo la consulta del perfil: ' + errReal.message, 500);
    }

    if (perfilReal) {
      // La fila EXISTE: el problema es una politica RLS
      return error(
        'Tu perfil existe pero las politicas de seguridad impiden leerlo. ' +
        'Ejecuta sql/001_schema.sql (seccion Row Level Security) en Supabase.',
        403
      );
    }

    // 3) La fila no existe: autorreparacion
    try {
      await reparar(sbAdmin, usuarioId, email);
    } catch (e) {
      return error('No se pudo crear tu empresa: ' + e.message, 500);
    }

    ({ data: perfil } = await sbAdmin.from('perfiles').select('*').eq('id', usuarioId).maybeSingle());
  }

  if (!perfil) return error('No se pudo recuperar el perfil', 500);
  if (!perfil.activo) return error('El usuario esta inactivo', 403);

  // La empresa debe existir
  const { data: empresa } = await conJwt(token).from('empresas')
    .select('id, nombre, giro_actual, plan').eq('id', perfil.empresa_id).maybeSingle();

  if (!empresa) {
    return error(
      'Tu perfil apunta a una empresa que ya no existe. ' +
      'Ejecuta sql/005_reparar_perfil.sql en Supabase.',
      409
    );
  }

  return Response.json({
    ok: true,
    access_token: token,
    refresh_token: data.session.refresh_token,
    usuario: publico(perfil, email, empresa),
  });
}

function publico(perfil, email, empresa) {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    rol: perfil.rol,
    area: perfil.area,
    empresa_id: perfil.empresa_id,
    empresa: empresa.nombre,
    giro_actual: empresa.giro_actual,
    super_admin: !!perfil.super_admin,
    email,
  };
}

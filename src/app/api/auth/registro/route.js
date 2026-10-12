import { NextRequest } from 'next/server';
import { admin, conJwt } from '@/lib/supabase';
import { error } from '@/lib/auth';

export const runtime = 'nodejs';

/* Registro online: crea el usuario de auth, su empresa y su perfil
   como administrador. Es el primer paso para que un cliente pueda
   usar el sistema sin que nadie lo cree a mano. */
export async function POST(request) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return error('Cuerpo JSON invalido');
  }

  const email = String(cuerpo.email || '').trim().toLowerCase();
  const password = String(cuerpo.password || '');
  const nombre = String(cuerpo.nombre || '').trim();
  const empresa = String(cuerpo.empresa || '').trim();
  const giro = String(cuerpo.giro || 'Construccion').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('Escribe un email valido');
  if (password.length < 6) return error('La contrasena debe tener al menos 6 caracteres');
  if (!nombre) return error('Escribe tu nombre');
  if (!empresa) return error('Escribe el nombre de tu empresa o negocio');

  const sb = admin();

  // El giro debe existir en el catalogo compartido
  const { data: giroValido } = await sb.from('giros').select('nombre').eq('nombre', giro).maybeSingle();
  if (!giroValido) return error('El giro seleccionado no es valido');

  const { data: creado, error: errUsuario } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errUsuario || !creado?.user) {
    const msg = errUsuario?.message || '';
    if (/already|exists|registered/i.test(msg)) return error('Ese email ya esta registrado', 409);
    return error('No se pudo crear el usuario: ' + msg, 500);
  }

  try {
    // Empresa (inquilino)
    const { data: emp, error: errEmp } = await sb
      .from('empresas')
      .insert({ nombre: empresa, email, giro_actual: giro, rif: cuerpo.rif || null, plan: 'trial' })
      .select('id')
      .single();
    if (errEmp) throw errEmp;

    // Perfil: el que se registra es administrador de su empresa
    const { error: errPerfil } = await sb.from('perfiles').insert({
      id: creado.user.id,
      empresa_id: emp.id,
      nombre,
      rol: 'admin',
      area: 'Administracion',
    });
    if (errPerfil) throw errPerfil;

    // Categoria inicial para que no arranque vacio
    await sb.from('categorias').insert({ empresa_id: emp.id, nombre: 'General' });
  } catch (err) {
    // Si algo falla, limpiamos el usuario para no dejar cuentas huerfanas
    await sb.auth.admin.deleteUser(creado.user.id).catch(() => {});
    return error('No se pudo completar el registro: ' + err.message, 500);
  }

  // Sesion inmediata: no obligamos a iniciar sesion aparte
  const { data: sesion, error: errSesion } = await conJwt().auth.signInWithPassword({ email, password });
  if (errSesion || !sesion?.session) {
    return Response.json({ ok: true, requiereLogin: true }, { status: 201 });
  }

  return Response.json({
    ok: true,
    access_token: sesion.session.access_token,
    refresh_token: sesion.session.refresh_token,
  }, { status: 201 });
}

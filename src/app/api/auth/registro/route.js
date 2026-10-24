import { NextRequest } from 'next/server';
import { admin, conJwt } from '@/lib/supabase';
import { error } from '@/lib/auth';
import {
  esPaisValido, esMonedaValida, monedaDePais,
  PAIS_POR_DEFECTO, MONEDA_POR_DEFECTO,
} from '@/lib/monedas';
import { DIAS_PRUEBA, PLAN_EN_PRUEBA } from '@/lib/planes';

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
  const claveAdmin = String(cuerpo.clave_admin || '').trim();

  // Pais y moneda: si no mandan moneda, se propone la del pais elegido.
  const pais = String(cuerpo.pais || PAIS_POR_DEFECTO).trim().toUpperCase();
  let moneda = String(cuerpo.moneda || '').trim().toUpperCase();
  if (!moneda) moneda = monedaDePais(pais);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('Escribe un email valido');
  if (password.length < 6) return error('La contrasena debe tener al menos 6 caracteres');
  if (!nombre) return error('Escribe tu nombre');
  if (!empresa) return error('Escribe el nombre de tu empresa o negocio');
  if (!esPaisValido(pais)) return error('El pais seleccionado no es valido');
  if (!esMonedaValida(moneda)) return error('La moneda seleccionada no es valida');

  const sb = admin();

  // El giro debe existir en el catalogo compartido
  const { data: giroValido } = await sb.from('giros').select('nombre').eq('nombre', giro).maybeSingle();
  if (!giroValido) return error('El giro seleccionado no es valido');

  // Clave de administrador (opcional). Si la manda y no sirve, se avisa:
  // mas vale un error claro que crear una cuenta sin el nivel esperado.
  let superAdmin = false;
  if (claveAdmin) {
    const { data: claveId } = await sb.rpc('consumir_clave_admin', { p_codigo: claveAdmin });
    if (!claveId) return error('La clave de administrador no es valida o ya fue usada', 403);
    superAdmin = true;
  }

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
    // Empresa (inquilino). pais/moneda son de la migracion 012: si la
    // base todavia no la tiene, se crea igual sin esos campos.
    let { data: emp, error: errEmp } = await sb
      .from('empresas')
      .insert({ nombre: empresa, email, giro_actual: giro, rif: cuerpo.rif || null, plan: PLAN_EN_PRUEBA, pais, moneda })
      .select('id')
      .single();
    if (errEmp) {
      ({ data: emp, error: errEmp } = await sb
        .from('empresas')
        .insert({ nombre: empresa, email, giro_actual: giro, rif: cuerpo.rif || null, plan: PLAN_EN_PRUEBA })
        .select('id')
        .single());
    }
    if (errEmp) throw errEmp;

    // Perfil: el que se registra es administrador de su empresa
    const { error: errPerfil } = await sb.from('perfiles').insert({
      id: creado.user.id,
      empresa_id: emp.id,
      nombre,
      rol: 'admin',
      area: 'Administracion',
      super_admin: superAdmin,
    });
    if (errPerfil) throw errPerfil;

    // Categoria inicial para que no arranque vacio
    await sb.from('categorias').insert({ empresa_id: emp.id, nombre: 'General' });

    // Suscripcion (plan de prueba con vencimiento) y almacen principal.
    // Best-effort: si la migracion 013 aun no esta aplicada NO se rompe el
    // registro; supabase devuelve {error} y aqui se ignora a proposito.
    try {
      await sb.from('suscripciones_empresas').insert({
        empresa_id: emp.id,
        plan: PLAN_EN_PRUEBA,
        estado: 'trial',
        trial_ends_at: new Date(Date.now() + DIAS_PRUEBA * 86400000).toISOString(),
      });
    } catch { /* migracion 013 pendiente */ }

    try {
      await sb.from('almacenes').insert({
        empresa_id: emp.id, nombre: 'Principal', principal: true, activo: true,
      });
    } catch { /* migracion 013 pendiente */ }

    // Tracking de marketing: registrar el registro como trafico y conversion.
    // Best-effort: si las tablas no existen, no afecta el registro.
    let campanaId = null;
    const utmCampaign = String(cuerpo.utm_campaign || '').trim();
    if (utmCampaign) {
      try {
        const { data: camp } = await sb.from('campanas')
          .select('id').eq('utm_campaign', utmCampaign).maybeSingle();
        if (camp) campanaId = camp.id;
      } catch { /* migracion 030 pendiente */ }
    }

    try {
      await sb.from('trafico').insert({
        empresa_id: emp.id,
        campana_id: campanaId,
        fuente: cuerpo.utm_source || cuerpo.fuente || 'directo',
        medio: cuerpo.utm_medium || cuerpo.medio || null,
        utm_source: cuerpo.utm_source || null,
        utm_medium: cuerpo.utm_medium || null,
        utm_campaign: cuerpo.utm_campaign || null,
        utm_content: cuerpo.utm_content || null,
        utm_term: cuerpo.utm_term || null,
        pagina: cuerpo.pagina || '/registro',
        referer: cuerpo.referer || null,
        visitante_id: cuerpo.visitante_id || null,
        evento: 'registro',
      });
    } catch { /* migracion 030 pendiente */ }

    try {
      await sb.from('conversiones').insert({
        empresa_id: emp.id,
        campana_id: campanaId,
        tipo: 'registro',
        plan: PLAN_EN_PRUEBA,
        notas: 'Registro de nueva empresa',
      });
    } catch { /* migracion 030 pendiente */ }
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

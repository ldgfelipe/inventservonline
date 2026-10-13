import { error, sesion, tokenDe } from '@/lib/auth';
import { conJwt, admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/diagnostico
   Reporta, para la sesion actual, que ve el servidor y que ve la base
   de datos. Sirve para distinguir "el token no llega" de "falta la policy". */

async function ejecutar(request) {
  const token = tokenDe(request);
  if (!token) return error('Sin sesion: abre /diagnostico habiendo entrado antes', 401);

  const resultado = { sesion: {}, conToken: {}, conServiceRole: {}, base: {} };

  // 1. ¿El token es valido?
  const sb = conJwt(token);
  const { data: authData, error: errAuth } = await sb.auth.getUser(token);
  resultado.sesion.token_valido = !errAuth && !!authData?.user;
  resultado.sesion.usuario_id = authData?.user ? authData.user.id : null;
  resultado.sesion.email = authData?.user ? authData.user.email : null;
  resultado.sesion.error = errAuth ? errAuth.message : null;

  // 2. ¿Que dice Postgres de la sesion? (auth.uid, rol del jwt, policies)
  const { data: dbInfo, error: errDb } = await sb.rpc('diagnostico_json');
  if (errDb) {
    resultado.base.error = errDb.message;
    resultado.base.nota = 'Falta ejecutar sql/007_diagnostico.sql';
  } else {
    resultado.base = dbInfo;
  }

  // 3. ¿Se puede leer el perfil con el token del usuario? (RLS aplica)
  if (resultado.sesion.usuario_id) {
    const { data: perfil, error: errPerfil } = await sb.from('perfiles')
      .select('id, empresa_id, nombre, rol, super_admin')
      .eq('id', resultado.sesion.usuario_id)
      .maybeSingle();
    resultado.conToken.perfil_legible = !!perfil;
    resultado.conToken.perfil = perfil || null;
    resultado.conToken.error = errPerfil ? errPerfil.message : null;
  }

  // 4. Verdad absoluta con service_role (salta RLS)
  try {
    const sbAdmin = admin();
    const { data: perfilReal } = await sbAdmin.from('perfiles')
      .select('id, empresa_id, nombre, rol, super_admin')
      .eq('id', resultado.sesion.usuario_id)
      .maybeSingle();
    resultado.conServiceRole.perfil_existe = !!perfilReal;
    resultado.conServiceRole.perfil = perfilReal || null;

    const { data: emp } = await sbAdmin.from('empresas')
      .select('id, nombre, giro_actual').limit(5);
    resultado.conServiceRole.total_empresas = (emp || []).length;
  } catch (e) {
    resultado.conServiceRole.error = e.message;
  }

  return Response.json({ ok: true, diagnostico: resultado });
}

export const GET = ejecutar;

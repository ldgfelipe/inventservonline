import { error } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* POST /api/bajas { email, codigo?, motivo? }
   Registra la baja de un correo. Es publico: el enlace de baja se
   incluye en los correos enviados desde el sistema local del cliente. */
export async function POST(request) {
  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const email = String(cuerpo.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return error('El correo no es valido');
  }

  const codigo = String(cuerpo.codigo || '').trim();
  const motivo = String(cuerpo.motivo || '').trim() || null;
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const ua = request.headers.get('user-agent') || null;

  const sb = admin();

  let campanaId = null;
  if (codigo) {
    try {
      const { data: camp } = await sb.from('campanas')
        .select('id').eq('codigo', codigo).maybeSingle();
      if (camp) campanaId = camp.id;
    } catch { /* migracion 030 pendiente */ }
  }

  // Si ya estaba dado de baja, se responde ok (idempotente).
  try {
    const { data: existe } = await sb.from('email_bajas')
      .select('id').eq('email', email).maybeSingle();
    if (existe) return Response.json({ ok: true, ya_registrado: true });
  } catch (err) {
    if (/email_bajas|does not exist|schema cache/i.test(err.message)) {
      return error('Falta aplicar la migracion 040 (bajas de correo).', 409);
    }
  }

  const { error: err } = await sb.from('email_bajas').insert({
    email,
    campana_id: campanaId,
    token: codigo || null,
    motivo,
    ip,
    user_agent: ua,
  });

  // Carrera: otro proceso la registro al mismo tiempo.
  if (err && /duplicate|unique/i.test(err.message)) {
    return Response.json({ ok: true, ya_registrado: true });
  }
  if (err) return error('No se pudo registrar la baja: ' + err.message, 500);

  return Response.json({ ok: true, ya_registrado: false }, { status: 201 });
}

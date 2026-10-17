import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/email/config -> config de correo de mi empresa */
async function leer(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  const { data, error: err } = await sb.from('email_config').select('id, activo, smtp_host, smtp_port, smtp_user, from_name, from_email, to_emails').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (err) {
    if (/email_config|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, config: null });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, config: data || null });
}

/* POST /api/email/config { activo, smtp_host, smtp_port, smtp_user, smtp_pass, from_name, from_email, to_emails } */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const fila = {
    empresa_id: perfil.empresa_id,
    activo: cuerpo.activo === true,
    smtp_host: cuerpo.smtp_host || null,
    smtp_port: Number(cuerpo.smtp_port) || 587,
    smtp_user: cuerpo.smtp_user || null,
    from_name: cuerpo.from_name || null,
    from_email: cuerpo.from_email || null,
    to_emails: cuerpo.to_emails || null,
    updated_at: new Date().toISOString(),
  };
  // Solo actualiza smtp_pass si se envio (no la sobrescribe con vacio).
  if (cuerpo.smtp_pass) fila.smtp_pass = cuerpo.smtp_pass;

  const { data: existe } = await sb.from('email_config').select('id').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (existe) {
    const { error: err } = await sb.from('email_config').update(fila).eq('empresa_id', perfil.empresa_id);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  } else {
    const { error: err } = await sb.from('email_config').insert(fila);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  }
  return Response.json({ ok: true });
}

/* POST /api/email/test -> envia un correo de prueba */
async function probar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  const { enviarCorreo } = await import('@/lib/email');
  const r = await enviarCorreo(sb, perfil.empresa_id, {
    asunto: 'Prueba de correo - inventserOnline',
    texto: 'Si recibes este correo, la configuracion de email funciona correctamente.',
    html: '<p>Si recibes este correo, la configuracion de email funciona correctamente.</p>',
  });
  if (!r.ok) return error(r.error || 'No se pudo enviar', 500);
  return Response.json({ ok: true, mensaje: 'Correo de prueba enviado' });
}

export const GET = manejar(leer);
export const POST = manejar(async (req) => {
  // Distingue por accion en el cuerpo
  let cuerpo; try { cuerpo = await req.json(); } catch { cuerpo = {}; }
  if (cuerpo.accion === 'test' || cuerpo.test === true) {
    // re-invocar probar con el request original no es posible; reimplementamos inline
    const { perfil, sb } = await sesion(req);
    exigir(perfil, 'config.ver');
    const { enviarCorreo } = await import('@/lib/email');
    const r = await enviarCorreo(sb, perfil.empresa_id, {
      asunto: 'Prueba de correo - inventserOnline',
      texto: 'Si recibes este correo, la configuracion de email funciona correctamente.',
      html: '<p>Si recibes este correo, la configuracion de email funciona correctamente.</p>',
    });
    if (!r.ok) return error(r.error || 'No se pudo enviar', 500);
    return Response.json({ ok: true, mensaje: 'Correo de prueba enviado' });
  }
  return guardar(req);
});

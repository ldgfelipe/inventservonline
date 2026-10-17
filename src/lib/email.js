/* ============================================================
   Envio de correo por SMTP (servidor). Usa nodemailer.
   Solo servidor. Si no hay config activa, no envia nada.
   ============================================================ */

import nodemailer from 'nodemailer';

/* Lee la config de email de la empresa. */
export async function leerConfig(sb, empresaId) {
  const { data } = await sb.from('email_config').select('*').eq('empresa_id', empresaId).maybeSingle();
  return data || null;
}

/* Envia un correo si la config esta activa. Devuelve { ok, error? }. */
export async function enviarCorreo(sb, empresaId, { asunto, html, texto }) {
  const cfg = await leerConfig(sb, empresaId);
  if (!cfg || !cfg.activo) return { ok: false, error: 'Correo no configurado o inactivo' };
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass || !cfg.from_email || !cfg.to_emails) {
    return { ok: false, error: 'Configuracion de correo incompleta' };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: Number(cfg.smtp_port) || 587,
      secure: Number(cfg.smtp_port) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });
    await transporter.sendMail({
      from: `"${cfg.from_name || 'inventserOnline'}" <${cfg.from_email}>`,
      to: cfg.to_emails,
      subject: asunto,
      text: texto || '',
      html: html || '',
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

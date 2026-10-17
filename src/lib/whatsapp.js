/* ============================================================
   Envio de mensajes por WhatsApp Business Cloud API (Meta).
   Solo servidor. Si no hay config activa, no envia nada.
   ============================================================ */

export async function leerConfig(sb, empresaId) {
  const { data } = await sb.from('whatsapp_config').select('*').eq('empresa_id', empresaId).maybeSingle();
  return data || null;
}

export async function enviarWhatsApp(sb, empresaId, { mensaje }) {
  const cfg = await leerConfig(sb, empresaId);
  if (!cfg || !cfg.activo) return { ok: false, error: 'WhatsApp no configurado o inactivo' };
  if (!cfg.phone_number_id || !cfg.access_token || !cfg.to_phones) {
    return { ok: false, error: 'Configuracion de WhatsApp incompleta' };
  }
  const telefonos = cfg.to_phones.split(',').map((t) => t.trim()).filter(Boolean);
  const resultados = [];
  for (const tel of telefonos) {
    try {
      const r = await fetch(`https://graph.facebook.com/v18.0/${cfg.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: tel.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { body: mensaje },
        }),
      });
      const json = await r.json();
      resultados.push({ telefono: tel, ok: r.ok, error: r.ok ? null : (json.error?.message || 'Error') });
    } catch (err) {
      resultados.push({ telefono: tel, ok: false, error: err.message });
    }
  }
  const ok = resultados.some((r) => r.ok);
  return { ok, resultados };
}

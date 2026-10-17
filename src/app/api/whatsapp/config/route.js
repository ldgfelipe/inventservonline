import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/whatsapp/config -> config de WhatsApp de mi empresa */
async function leer(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  const { data, error: err } = await sb.from('whatsapp_config').select('id, activo, phone_number_id, to_phones').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (err) {
    if (/whatsapp_config|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, config: null });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, config: data || null });
}

/* POST /api/whatsapp/config { activo, phone_number_id, access_token, to_phones } */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const fila = {
    empresa_id: perfil.empresa_id,
    activo: cuerpo.activo === true,
    phone_number_id: cuerpo.phone_number_id || null,
    to_phones: cuerpo.to_phones || null,
    updated_at: new Date().toISOString(),
  };
  if (cuerpo.access_token) fila.access_token = cuerpo.access_token;

  const { data: existe } = await sb.from('whatsapp_config').select('id').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (existe) {
    const { error: err } = await sb.from('whatsapp_config').update(fila).eq('empresa_id', perfil.empresa_id);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  } else {
    const { error: err } = await sb.from('whatsapp_config').insert(fila);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  }
  return Response.json({ ok: true });
}

/* POST /api/whatsapp/test -> envia un mensaje de prueba */
async function probar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  const { enviarWhatsApp } = await import('@/lib/whatsapp');
  const r = await enviarWhatsApp(sb, perfil.empresa_id, { mensaje: 'Prueba de WhatsApp - inventserOnline. Si recibes este mensaje, la configuracion funciona.' });
  if (!r.ok) return error(r.resultados ? r.resultados.map((x) => x.error).join(', ') : 'No se pudo enviar', 500);
  return Response.json({ ok: true, mensaje: 'Mensaje de prueba enviado' });
}

export const GET = manejar(leer);
export const POST = manejar(async (req) => {
  let cuerpo; try { cuerpo = await req.json(); } catch { cuerpo = {}; }
  if (cuerpo.accion === 'test' || cuerpo.test === true) {
    const { perfil, sb } = await sesion(req);
    exigir(perfil, 'config.ver');
    const { enviarWhatsApp } = await import('@/lib/whatsapp');
    const r = await enviarWhatsApp(sb, perfil.empresa_id, { mensaje: 'Prueba de WhatsApp - inventserOnline. Si recibes este mensaje, la configuracion funciona.' });
    if (!r.ok) return error(r.resultados ? r.resultados.map((x) => x.error).join(', ') : 'No se pudo enviar', 500);
    return Response.json({ ok: true, mensaje: 'Mensaje de prueba enviado' });
  }
  return guardar(req);
});

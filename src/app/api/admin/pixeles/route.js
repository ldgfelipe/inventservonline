import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';
import { invalidarCacheConfigSitio } from '@/lib/config-sitio';

export const runtime = 'nodejs';

/* GET /api/admin/pixeles -> configuracion global de seguimiento */
async function leer(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sb = admin();
  const { data, error: err } = await sb.from('configuracion_sitio').select('*').eq('id', 1).maybeSingle();
  if (err) {
    if (/configuracion_sitio|does not exist|schema cache/i.test(err.message)) {
      return Response.json({
        ok: true,
        config: { ga_measurement_id: '', gtm_id: '', head_code: '', body_open_code: '', body_close_code: '' },
        aviso: 'Falta aplicar la migracion 042 (configuracion del sitio).',
      });
    }
    return error(err.message, 500);
  }
  const cfg = data || {};
  return Response.json({
    ok: true,
    config: {
      ga_measurement_id: cfg.ga_measurement_id || '',
      gtm_id: cfg.gtm_id || '',
      head_code: cfg.head_code || '',
      body_open_code: cfg.body_open_code || '',
      body_close_code: cfg.body_close_code || '',
    },
  });
}

/* POST /api/admin/pixeles { ga_measurement_id, gtm_id, head_code, body_open_code, body_close_code } */
async function guardar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const ga = String(cuerpo.ga_measurement_id || '').trim();
  const gtm = String(cuerpo.gtm_id || '').trim();
  if (ga && !/^G-[A-Z0-9]{4,20}$/i.test(ga)) return error('El ID de Google Analytics debe tener el formato G-XXXXXXX');
  if (gtm && !/^GTM-[A-Z0-9]{4,20}$/i.test(gtm)) return error('El ID de Tag Manager debe tener el formato GTM-XXXXXXX');

  const fila = {
    ga_measurement_id: ga || null,
    gtm_id: gtm || null,
    head_code: String(cuerpo.head_code || ''),
    body_open_code: String(cuerpo.body_open_code || ''),
    body_close_code: String(cuerpo.body_close_code || ''),
    updated_at: new Date().toISOString(),
  };

  const sb = admin();
  const { data: existe } = await sb.from('configuracion_sitio').select('id').eq('id', 1).maybeSingle();
  const { error: err } = existe
    ? await sb.from('configuracion_sitio').update(fila).eq('id', 1)
    : await sb.from('configuracion_sitio').insert({ id: 1, ...fila });

  if (err) return error('No se pudo guardar: ' + err.message, 500);
  invalidarCacheConfigSitio();
  return Response.json({ ok: true });
}

export const GET = manejar(leer);
export const POST = manejar(guardar);

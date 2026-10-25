/* ============================================================
   Configuracion global del sitio: pixeles y codigo de seguimiento.
   Se lee desde el layout raiz (servidor) y se cachea 60 s.
   ============================================================ */

import { admin } from '@/lib/supabase';

const VACIA = {
  ga_measurement_id: '',
  gtm_id: '',
  head_code: '',
  body_open_code: '',
  body_close_code: '',
};

let cache = null;
let cacheAt = 0;
const TTL = 60 * 1000;

export async function leerConfigSitio({ force = false } = {}) {
  const ahora = Date.now();
  if (!force && cache && (ahora - cacheAt) < TTL) return cache;

  const base = { ...VACIA };
  try {
    const sb = admin();
    const { data } = await sb.from('configuracion_sitio').select('*').eq('id', 1).maybeSingle();
    if (data) {
      for (const k of Object.keys(base)) {
        if (data[k] !== null && data[k] !== undefined) base[k] = String(data[k]);
      }
    }
  } catch { /* si falta la migracion o las env, se usa vacio */ }

  cache = base;
  cacheAt = ahora;
  return base;
}

export function invalidarCacheConfigSitio() {
  cache = null;
  cacheAt = 0;
}

/* Bloques estandar de GA4 / GTM. */
export function snippetGtmHead(gtmId) {
  if (!gtmId) return '';
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
}

export function snippetGtmBody(gtmId) {
  if (!gtmId) return '';
  return `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
}

export function snippetGa4(gaId) {
  if (!gaId) return '';
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
}

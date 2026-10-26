'use client';

import { useEffect } from 'react';

function soloJs(codigo) {
  return String(codigo || '')
    .replace(/<script[^>]*>/gi, '')
    .replace(/<\/script>/gi, '')
    .trim();
}

function gtmHead(gtmId) {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
}

function gaConfig(gaId) {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
}

function agregarScript(codigo, destino) {
  const js = soloJs(codigo);
  if (!js) return;
  const s = document.createElement('script');
  s.setAttribute('data-inv-pixel', '1');
  s.text = js;
  (destino || document.head).appendChild(s);
}

/* Carga los pixeles configurados en /admin. Se hace en el navegador para
   que los cambios se apliquen al instante, sin esperar un redeploy. */
export default function PixelesSitio() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__invPixelesCargados) return;
    window.__invPixelesCargados = true;

    let cancelado = false;
    fetch('/api/pixeles', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelado || !j || !j.ok) return;
        const c = j.config || {};
        const headCode = String(c.head_code || '');
        const yaTieneGtag = /googletagmanager\.com\/gtag\/js/i.test(headCode);
        const yaTieneGtm = /googletagmanager\.com\/gtm\.js/i.test(headCode);

        // Google Analytics 4
        if (c.ga_measurement_id && !yaTieneGtag) {
          const g = document.createElement('script');
          g.async = true;
          g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(c.ga_measurement_id);
          g.setAttribute('data-inv-pixel', '1');
          document.head.appendChild(g);
          agregarScript(gaConfig(c.ga_measurement_id), document.head);
        }

        // Google Tag Manager
        if (c.gtm_id && !yaTieneGtm) agregarScript(gtmHead(c.gtm_id), document.head);

        // Codigo personalizado
        if (headCode) agregarScript(headCode, document.head);
        if (c.body_open_code) agregarScript(c.body_open_code, document.body);
        if (c.body_close_code) agregarScript(c.body_close_code, document.body);
      })
      .catch(() => { /* el tracking nunca debe romper la pagina */ });

    return () => { cancelado = true; };
  }, []);

  return null;
}

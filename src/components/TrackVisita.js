'use client';

import { useEffect } from 'react';

function uuid() {
  try {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  } catch { /* noop */ }
  return 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function visitante() {
  try {
    let v = localStorage.getItem('inv_visitante');
    if (!v) { v = uuid(); localStorage.setItem('inv_visitante', v); }
    return v;
  } catch { return null; }
}

function sesion() {
  try {
    let s = sessionStorage.getItem('inv_sesion');
    if (!s) { s = uuid(); sessionStorage.setItem('inv_sesion', s); }
    return s;
  } catch { return null; }
}

/* Construye el payload de tracking con UTM y procedencia. */
function datosTracking(evento = 'visita', extra = {}) {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = {
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      utm_content: params.get('utm_content') || undefined,
      utm_term: params.get('utm_term') || undefined,
    };
    const referer = document.referrer || '';
    let refHost = '';
    try { refHost = referer ? new URL(referer).hostname : ''; } catch { refHost = ''; }
    const payload = {
      evento,
      pagina: window.location.pathname,
      fuente: utm.utm_source || refHost || 'directo',
      medio: utm.utm_medium || (refHost ? 'referral' : 'directo'),
      ...utm,
      referer,
      visitante_id: visitante(),
      sesion_id: sesion(),
      ...extra,
    };
    guardarAtribucion(payload);
    return payload;
  } catch {
    return { evento, ...extra };
  }
}

/* Conserva la primera atribucion con UTM para poder enviarla al registrarse. */
function guardarAtribucion(p) {
  try {
    const prev = JSON.parse(localStorage.getItem('inv_atribucion') || 'null');
    if (prev && prev.utm_campaign) return;
    localStorage.setItem('inv_atribucion', JSON.stringify({
      utm_source: p.utm_source || null,
      utm_medium: p.utm_medium || null,
      utm_campaign: p.utm_campaign || null,
      utm_content: p.utm_content || null,
      utm_term: p.utm_term || null,
      fuente: p.fuente || null,
      medio: p.medio || null,
      referer: p.referer || null,
      visitante_id: p.visitante_id || null,
    }));
  } catch { /* noop */ }
}

function enviar(payload) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/trafico', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/trafico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch { /* el tracking nunca debe romper la pagina */ }
}

/* Registra un evento suelto (demo, click, etc.) desde cualquier pagina. */
export function registrarEvento(evento, extra = {}) {
  enviar(datosTracking(evento, extra));
}

/* Componente invisible: registra la visita al montar la pagina. */
export default function TrackVisita({ evento = 'visita', pagina = null }) {
  useEffect(() => {
    const extra = pagina ? { pagina } : {};
    enviar(datosTracking(evento, extra));
  }, [evento, pagina]);

  return null;
}

/* ============================================================
   Sesion en el navegador: lectura, renovacion y fetch autenticado.
   La sesion dura hasta que el usuario cierre sesion o sea bloqueado.
   ============================================================ */

export const CLAVE_SESION = 'inventarios_sesion';

export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null');
  } catch {
    return null;
  }
}

export function guardarSesion(s) {
  if (!s || !s.access_token) return;
  localStorage.setItem(CLAVE_SESION, JSON.stringify({
    access_token: s.access_token,
    refresh_token: s.refresh_token || null,
  }));
  // Cookie de un año; se renueva junto con el token.
  document.cookie = `invetser_token=${s.access_token}; path=/; max-age=31536000; SameSite=Lax`;
}

export function borrarSesion() {
  localStorage.removeItem(CLAVE_SESION);
  document.cookie = 'invetser_token=; path=/; max-age=0';
}

export function tokenExpirado(token, margenMs = 60000) {
  try {
    const partes = String(token).split('.');
    if (partes.length !== 3) return true;
    const payload = JSON.parse(atob(partes[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now() + margenMs;
  } catch {
    return true;
  }
}

let refrescoEnCurso = null;

export async function refrescarSesion() {
  if (refrescoEnCurso) return refrescoEnCurso;
  refrescoEnCurso = (async () => {
    const sesion = leerSesion();
    if (!sesion || !sesion.refresh_token) return null;
    try {
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: sesion.refresh_token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) return null;
      guardarSesion({ access_token: j.access_token, refresh_token: j.refresh_token || sesion.refresh_token });
      return j.access_token;
    } catch {
      return null;
    }
  })();
  try {
    return await refrescoEnCurso;
  } finally {
    refrescoEnCurso = null;
  }
}

/* Devuelve una sesion con access_token vigente (renueva si hace falta). */
export async function asegurarSesion() {
  const sesion = leerSesion();
  if (!sesion || !sesion.access_token) return null;
  if (!tokenExpirado(sesion.access_token)) return sesion;
  const nuevo = await refrescarSesion();
  return nuevo ? leerSesion() : sesion;
}

/* fetch autenticado con renovacion automatica y reintento en 401. */
export async function fetchConSesion(url, opciones = {}) {
  let sesion = await asegurarSesion();

  const hacer = (token) => fetch(url, {
    ...opciones,
    headers: {
      ...(opciones.headers || {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  });

  let respuesta = await hacer(sesion && sesion.access_token);
  if (respuesta.status === 401) {
    const nuevo = await refrescarSesion();
    if (nuevo) {
      respuesta = await hacer(nuevo);
    } else {
      borrarSesion();
    }
  }
  return respuesta;
}

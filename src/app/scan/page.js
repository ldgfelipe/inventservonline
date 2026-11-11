'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';
import Footer from '@/components/Footer';
import { asegurarSesion, leerSesion, fetchConSesion } from '@/lib/sesionCliente';

/**
 * Página de descarga del scanner móvil.
 * El escáner web está deshabilitado; la función se realiza vía app Android.
 */
export default function ScanPage() {
  const [sessionStatus, setSessionStatus] = useState('cargando');
  const [usuarioNombre, setUsuarioNombre] = useState('');

  useEffect(() => {
    (async () => {
      await asegurarSesion();
      const s = leerSesion();
      const token = s && s.access_token;
      if (!token) { setSessionStatus('sin-sesion'); return; }
      try {
        const r = await fetchConSesion('/api/auth/sesion', { cache: 'no-store' });
        if (!r.ok) { setSessionStatus('sin-sesion'); return; }
        const j = await r.json();
        const u = j.usuario;
        setUsuarioNombre(u.nombre || u.usuario || '');
        if (u.super_admin) setSessionStatus('super'); else setSessionStatus('usuario');
      } catch { setSessionStatus('sin-sesion'); }
    })();
  }, []);

  return (
    <>
      <header className="landing-header">
        <Link href="/" className="landing-marca" aria-label="inventserOnline">
          <img src="/logo.png" alt="inventserOnline" className="landing-logo" width="96" height="52" />
          <span className="landing-tagline">Sistema de Inventarios</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
          {sessionStatus !== 'sin-sesion' && <Link className="btn" href="/panel">Ir al panel</Link>}
          <GoogleTranslate />
        </nav>
      </header>

      <main style={{ maxWidth: 480, margin: '32px auto 48px', padding: '0 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>Scanner de Códigos</h1>

        {sessionStatus === 'cargando' && <p style={{ color: '#555' }}>Verificando tu sesión…</p>}

        {sessionStatus === 'sin-sesion' && (
          <>
            <p style={{ color: '#555', margin: '0 0 16px' }}>Para usar el escáner necesitas iniciar sesión.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn" href="/entrar">Iniciar sesión</Link>
              <Link className="btn btn-secundario" href="/registro">Crear cuenta</Link>
            </div>
          </>
        )}

        {(sessionStatus === 'super' || sessionStatus === 'usuario') && (
          <>
            <div style={{ marginBottom: 24, padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
              <h3 style={{ color: '#1e40af', margin: '0 0 8px' }}>🔐 Funcionalidad disponible vía app Android</h3>
              <p style={{ margin: 0, color: '#64748b' }}>
                El escáner de códigos QR y códigos de barras está disponible únicamente en la app móvil.
              </p>
            </div>

            <div style={{ textAlign: 'left', marginBottom: 24 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 16 }}>Cómo usar:</h4>
              <ol style={{ textAlign: 'left', paddingLeft: 20, marginBottom: 16 }}>
                <li>Descarga la app desde Google Play o alénzala desde este enlace.</li>
                <li>Inicia sesión con tu cuenta de inventserOnline.</li>
                <li>Usa la cámara del móvil para escanear códigos.</li>
              </ol>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                La app está disponible para:
              </p>
            </div>

            <div style={{ textDecoration: 'line-through', color: '#94a3b8', marginBottom: 20 }}>
              <p style={{ margin: '0 0 12px' }}>Enlace de descarga: <strong id="download-link">https://...</strong></p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>La app todavía está en producción. Vuelve pronto o usa el panel web.</p>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn" href="/panel">Ir al panel</Link>
              <Link className="btn btn-secundario" href="/etiquetas">Generar etiquetas</Link>
            </div>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
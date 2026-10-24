'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FormularioBaja({ email, codigo }) {
  const [estado, setEstado] = useState('inicial'); // inicial | enviando | listo | error
  const [mensaje, setMensaje] = useState('');

  async function confirmar() {
    if (!email) {
      setEstado('error');
      setMensaje('El enlace no incluye un correo valido.');
      return;
    }
    setEstado('enviando');
    try {
      const r = await fetch('/api/bajas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo registrar la baja');
      setEstado('listo');
      setMensaje(j.ya_registrado
        ? 'Este correo ya estaba dado de baja.'
        : 'Listo. Tu correo fue dado de baja de nuestras campanas.');
    } catch (err) {
      setEstado('error');
      setMensaje(err.message);
    }
  }

  return (
    <div className="tarjeta" style={{ maxWidth: 480, textAlign: 'center' }}>
      <Link href="/" style={{ display: 'inline-block', marginBottom: 20 }}>
        <img src="/logo.png" alt="inventserOnline" style={{ height: 56, width: 'auto' }} />
      </Link>

      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Darte de baja</h1>

      {estado === 'listo' ? (
        <p style={{ color: '#16a34a', fontSize: 15, lineHeight: 1.6 }}>{mensaje}</p>
      ) : (
        <>
          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
            Si ya no deseas recibir nuestras campanas por correo, confirma la baja.
            {email ? <> El correo a dar de baja es <strong>{email}</strong>.</> : null}
          </p>
          {estado === 'error' && (
            <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{mensaje}</p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirmar}
            disabled={estado === 'enviando'}
          >
            {estado === 'enviando' ? 'Procesando...' : 'Confirmar baja'}
          </button>
        </>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>
        <Link href="/" style={{ color: '#2563eb' }}>Volver al inicio</Link>
      </p>
    </div>
  );
}

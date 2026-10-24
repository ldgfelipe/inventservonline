'use client';

import { useState } from 'react';
import Link from 'next/link';

const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function FormularioBaja({ email, codigo }) {
  const [correo, setCorreo] = useState(email || '');
  const [estado, setEstado] = useState('inicial'); // inicial | enviando | listo | error
  const [mensaje, setMensaje] = useState('');

  // Si el enlace no trae correo, se pide escribirlo.
  const necesitaCorreo = !email;

  async function confirmar(e) {
    if (e) e.preventDefault();
    const destino = String(correo || '').trim().toLowerCase();
    if (!RE_EMAIL.test(destino)) {
      setEstado('error');
      setMensaje('Escribe un correo electronico valido.');
      return;
    }
    setEstado('enviando');
    try {
      const r = await fetch('/api/bajas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: destino, codigo }),
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
        <form onSubmit={confirmar}>
          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Si ya no deseas recibir nuestras campanas por correo, confirma la baja.
          </p>

          {necesitaCorreo ? (
            <div className="campo" style={{ textAlign: 'left' }}>
              <label>Correo que deseas dar de baja</label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                required
              />
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
              El correo a dar de baja es <strong>{email}</strong>.
            </p>
          )}

          {estado === 'error' && (
            <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{mensaje}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={estado === 'enviando'}
          >
            {estado === 'enviando' ? 'Procesando...' : 'Confirmar baja'}
          </button>
        </form>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>
        <Link href="/" style={{ color: '#2563eb' }}>Volver al inicio</Link>
      </p>
    </div>
  );
}

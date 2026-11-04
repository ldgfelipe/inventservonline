'use client';

import { useState } from 'react';

export default function ProfileBanner({ onComplete }) {
  const [empresa, setEmpresa] = useState('');
  const [logo, setLogo] = useState('');

  return (
    <div style={{
      background: '#fff',
      border: '2px solid #0077b5',
      borderRadius: 12,
      padding: '24px',
      maxWidth: 480,
      margin: '16px auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h3 style={{ marginTop: 0, color: '#0077b5' }}>
        Completa tu perfil de empresa
      </h3>
      <p style={{ color: '#555', fontSize: 14 }}>
        Para aprovechar al máximo inventserOnline, completa los datos de tu empresa.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <label style={{ fontWeight: 600, fontSize: 14 }}>Nombre de la empresa</label>
        <input
          type="text"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          placeholder="Mi Empresa S.A."
          style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <label style={{ fontWeight: 600, fontSize: 14 }}>Logo (URL o subir)</label>
        <input
          type="text"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          placeholder="https://tusitio.com/logo.png"
          style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4 }}
        />
      </div>
      <button
        onClick={() => onComplete && onComplete({ empresa, logo })}
        style={{
          marginTop: 16,
          padding: '10px 20px',
          background: '#0077b5',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Guardar perfil
      </button>
    </div>
  );
}

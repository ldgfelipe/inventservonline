'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DemoButton() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function probarDemo() {
    setCargando(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@abarrotes.com', password: 'demo123456' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo iniciar sesion');

      localStorage.setItem('inventarios_sesion', JSON.stringify({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
      }));
      document.cookie = `invetser_token=${j.access_token}; path=/; max-age=31536000; SameSite=Lax`;
      router.push('/panel');
    } catch (err) {
      alert('No se pudo iniciar sesion demo: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <button className="btn btn-demo" onClick={probarDemo} disabled={cargando}>
      {cargando ? 'Entrando...' : 'Probar el sistema'}
    </button>
  );
}

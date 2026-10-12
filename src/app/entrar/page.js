'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function FormularioEntrar() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (params.get('nuevo') === '1') setNota('Cuenta creada. Entra con tu email y contrasena.');
    if (params.get('expiro') === '1') setNota('Tu sesion expiro. Entra de nuevo.');
  }, [params]);

  function cambiar(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setNota('');
    setCargando(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo iniciar sesion');

      localStorage.setItem('inventarios_sesion', JSON.stringify({
        access_token: j.access_token, refresh_token: j.refresh_token,
      }));
      document.cookie = `invetser_token=${j.access_token}; path=/; max-age=2592000; SameSite=Lax`;
      router.push('/panel');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="tarjeta">
      <h1>Entrar</h1>
      <p className="sub">Accede a tu inventario desde cualquier equipo.</p>

      {nota && <div className="mensaje ok">{nota}</div>}
      {error && <div className="mensaje error">{error}</div>}

      <form onSubmit={enviar}>
        <div className="campo">
          <label>Email</label>
          <input type="email" name="email" value={form.email} onChange={cambiar} required autoComplete="username" />
        </div>
        <div className="campo">
          <label>Contrasena</label>
          <input type="password" name="password" value={form.password} onChange={cambiar} required autoComplete="current-password" />
        </div>
        <button className="btn btn-bloque" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="pie">
        No tienes cuenta? <Link href="/registro">Crear una gratis</Link>
      </p>
    </div>
  );
}

export default function Entrar() {
  return (
    <main className="pagina-form">
      <Suspense fallback={<div className="tarjeta"><h1>Entrar</h1></div>}>
        <FormularioEntrar />
      </Suspense>
    </main>
  );
}

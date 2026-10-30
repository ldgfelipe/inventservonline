'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { t, detectLocale } from '@/lib/i18n';

function FormularioEntrar() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    // Recuperar el ultimo email usado, para no escribirlo cada vez
    const ultimo = localStorage.getItem('ultimo_email');
    if (ultimo) setForm((f) => ({ ...f, email: ultimo }));

    if (params.get('nuevo') === '1') setNota(t('login_nota_nueva', 'es'));
    if (params.get('expiro') === '1') setNota(t('login_nota_expirada', 'es'));
    if (params.get('salio') === '1') setNota(t('login_nota_salio', 'es'));
  }, [params]);

  function cambiar(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t('login_error_generico', 'es'));

      localStorage.setItem('inventarios_sesion', JSON.stringify({
        access_token: j.access_token, refresh_token: j.refresh_token,
      }));
      if (recordar) localStorage.setItem('ultimo_email', form.email);
      else localStorage.removeItem('ultimo_email');

      document.cookie = `invetser_token=${j.access_token}; path=/; max-age=31536000; SameSite=Lax`;
      router.push('/panel');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="tarjeta">
      <Link href="/" className="auth-logo" aria-label="inventserOnline - inicio">
        <img src="/logo.png" alt="inventserOnline" className="auth-logo-img" />
      </Link>
      <h1>{t('entrar_title','es')}</h1>
      <p className="sub">{t('login_subtitle','es')}</p>

      {nota && <div className="mensaje ok">{nota}</div>}
      {error && <div className="mensaje error">{error}</div>}

      <form onSubmit={enviar}>
        <div className="campo">
          <label>{t('login_email','es')}</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={cambiar}
            required
            autoComplete="username"
            placeholder="juan@empresa.com"
          />
        </div>
        <div className="campo">
          <label>{t('login_password','es')}</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={cambiar}
            required
            autoComplete="current-password"
            placeholder="Tu contrasena"
          />
        </div>

        <div className="campo">
          <label className="check-label">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(e) => setRecordar(e.target.checked)}
            />
            {t('login_recordar','es')}
          </label>
        </div>

        <button className="btn btn-bloque" disabled={cargando}>
          {cargando ? t('login_entrando','es') : t('login_entrar','es')}
        </button>
      </form>

      {error && /contrasena|incorrectos/i.test(error) && (
        <p className="ayuda" style={{ marginTop: 10 }}>
          Si olvidaste tu contrasena, pide al administrador que la restablezca
          desde Usuarios.
        </p>
      )}

      <p className="pie">
        {t('login_nueva_cuenta','es')} <Link href="/registro">{t('registro_continuar','es')}</Link>
      </p>
    </div>
  );
}

export default function Entrar() {
  return (
    <main className="pagina-form">
      <Suspense fallback={
        <div className="tarjeta">
          <Link href="/" className="auth-logo" aria-label="inventserOnline - inicio">
            <img src="/logo.png" alt="inventserOnline" className="auth-logo-img" />
          </Link>
          <h1>{t('entrar_title','es')}</h1>
        </div>
      }>
        <FormularioEntrar />
      </Suspense>
    </main>
  );
}

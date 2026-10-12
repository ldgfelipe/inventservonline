'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Registro() {
  const router = useRouter();
  const [giros, setGiros] = useState([]);
  const [form, setForm] = useState({ empresa: '', nombre: '', email: '', password: '', giro: '', rif: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch('/api/giros').then((r) => r.json()).then((j) => {
      const lista = j.giros || [];
      setGiros(lista);
      if (lista.length) setForm((f) => ({ ...f, giro: lista[0].nombre }));
    }).catch(() => {});
  }, []);

  function cambiar(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo completar el registro');

      if (j.access_token) {
        localStorage.setItem('inventarios_sesion', JSON.stringify({
          access_token: j.access_token, refresh_token: j.refresh_token,
        }));
        document.cookie = `invetser_token=${j.access_token}; path=/; max-age=2592000; SameSite=Lax`;
        router.push('/panel');
      } else {
        router.push('/entrar?nuevo=1');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="pagina-form">
      <div className="tarjeta">
        <h1>Crea tu cuenta</h1>
        <p className="sub">Empieza a usar el sistema en tu negocio. Sin instalar nada.</p>

        {error && <div className="mensaje error">{error}</div>}

        <form onSubmit={enviar}>
          <div className="campo">
            <label>Nombre de tu empresa o negocio</label>
            <input name="empresa" value={form.empresa} onChange={cambiar} placeholder="Ferreteria El Centro" required />
          </div>

          <div className="campo">
            <label>Tu nombre</label>
            <input name="nombre" value={form.nombre} onChange={cambiar} placeholder="Juan Perez" required />
          </div>

          <div className="campo">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={cambiar} placeholder="juan@empresa.com" required />
          </div>

          <div className="campo">
            <label>Contrasena</label>
            <input type="password" name="password" value={form.password} onChange={cambiar} placeholder="Minimo 6 caracteres" required />
            <div className="ayuda">Usaras este email y contrasena para entrar.</div>
          </div>

          <div className="campo">
            <label>Giro de tu negocio</label>
            <select name="giro" value={form.giro} onChange={cambiar} required>
              {giros.map((g) => <option key={g.id} value={g.nombre}>{g.nombre}</option>)}
            </select>
            <div className="ayuda">Define los campos que pediran tus productos. Despues puedes cambiarlo.</div>
          </div>

          <button className="btn btn-bloque" disabled={cargando}>
            {cargando ? 'Creando cuenta...' : 'Crear cuenta y entrar'}
          </button>
        </form>

        <p className="pie">
          Ya tienes cuenta? <Link href="/entrar">Entrar</Link>
        </p>
      </div>
    </main>
  );
}

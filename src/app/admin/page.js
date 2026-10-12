'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Admin() {
  const [usuario, setUsuario] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [claves, setClaves] = useState([]);
  const [giros, setGiros] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [nuevaClave, setNuevaClave] = useState({ descripcion: '', max_usos: 1, dias: 0 });

  useEffect(() => {
    fetch('/api/auth/sesion', { headers: auth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUsuario(j ? j.usuario : null))
      .catch(() => setUsuario(null))
      .finally(() => setCargandoSesion(false));
  }, []);

  useEffect(() => {
    if (!usuario || !usuario.super_admin) return;
    cargarClaves();
    fetch('/api/giros').then((r) => r.json()).then((j) => setGiros(j.giros || [])).catch(() => {});
    fetch('/api/empresa', { headers: auth() }).then((r) => r.json()).then((j) => setEmpresa(j.empresa)).catch(() => {});
  }, [usuario]);

  function auth() {
    const s = JSON.parse(localStorage.getItem('inventarios_sesion') || '{}');
    return s.access_token ? { Authorization: 'Bearer ' + s.access_token } : {};
  }

  async function cargarClaves() {
    const r = await fetch('/api/admin/claves', { headers: auth() });
    const j = await r.json();
    if (r.ok) setClaves(j.claves || []);
    else setError(j.error || 'No se pudieron cargar las claves');
  }

  async function crearClave(e) {
    e.preventDefault();
    setError('');
    setMensaje('');
    const r = await fetch('/api/admin/claves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(nuevaClave),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo crear');
    // Esta es la UNICA vez que se ve el codigo completo
    setMensaje(`Clave creada: ${j.clave.codigo}  (guardala, no se volvera a mostrar)`);
    setNuevaClave({ descripcion: '', max_usos: 1, dias: 0 });
    cargarClaves();
  }

  async function alternar(id, activa) {
    await fetch('/api/admin/claves', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ id, activa }),
    });
    cargarClaves();
  }

  async function cambiarGiro(nombre) {
    const r = await fetch('/api/giros', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ nombre }),
    });
    if (r.ok) {
      setMensaje('Giro actualizado a ' + nombre);
      const j = await fetch('/api/empresa', { headers: auth() }).then((x) => x.json());
      setEmpresa(j.empresa);
    }
  }

  if (cargandoSesion) return <div className="cargando">Verificando sesion...</div>;

  if (!usuario) {
    return (
      <main className="admin">
        <div className="tarjeta">
          <h1>Acceso restringido</h1>
          <p className="sub">Necesitas iniciar sesion.</p>
          <Link className="btn" href="/entrar">Entrar</Link>
        </div>
      </main>
    );
  }

  if (!usuario.super_admin) {
    return (
      <main className="admin">
        <div className="tarjeta">
          <h1>Sin acceso</h1>
          <p className="sub">Esta seccion es solo para administradores de la plataforma.</p>
          <Link className="btn" href="/panel">Volver al sistema</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin admin-ancho">
      <header className="admin-header">
        <div>
          <h1>Administracion</h1>
          <p className="sub">Hola {usuario.nombre}. Gestiona claves y el giro del sistema.</p>
        </div>
        <Link className="btn btn-secundario" href="/panel">Ir al sistema</Link>
      </header>

      {mensaje && <div className="mensaje ok">{mensaje}</div>}
      {error && <div className="mensaje error">{error}</div>}

      <section className="panel-admin">
        <h2>Giro de la empresa ({empresa ? empresa.nombre : '...'})</h2>
        <p className="ayuda">Selecciona el tipo de empresa. Define los campos que pediran los productos.</p>
        <div className="rejilla-giros">
          {giros.map((g) => (
            <button
              key={g.id}
              className={`giro-opcion ${empresa && empresa.giro_actual === g.nombre ? 'activo' : ''}`}
              onClick={() => cambiarGiro(g.nombre)}
            >
              {g.nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-admin">
        <h2>Claves de administrador</h2>
        <p className="ayuda">
          Cada clave da acceso de administrador de la plataforma a quien se registre con ella.
          Se consumen al usarse.
        </p>

        <form className="form-clave" onSubmit={crearClave}>
          <input
            placeholder="Descripcion (ej: para soporte)"
            value={nuevaClave.descripcion}
            onChange={(e) => setNuevaClave((c) => ({ ...c, descripcion: e.target.value }))}
          />
          <input
            type="number" min="1" title="Usos permitidos"
            value={nuevaClave.max_usos}
            onChange={(e) => setNuevaClave((c) => ({ ...c, max_usos: Number(e.target.value) }))}
          />
          <input
            type="number" min="0" title="Dias para vencer (0 = sin vencimiento)"
            value={nuevaClave.dias}
            onChange={(e) => setNuevaClave((c) => ({ ...c, dias: Number(e.target.value) }))}
          />
          <button className="btn">Crear clave</button>
        </form>

        <table className="tabla-admin">
          <thead>
            <tr><th>Codigo</th><th>Descripcion</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {claves.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.codigo}</td>
                <td>{c.descripcion || '-'}</td>
                <td>{c.usos} / {c.max_usos}</td>
                <td>{c.expira_en ? new Date(c.expira_en).toLocaleDateString('es-VE') : 'sin vencimiento'}</td>
                <td><span className={`estado ${c.activa ? 'verde' : 'rojo'}`}>{c.activa ? 'Activa' : 'Inactiva'}</span></td>
                <td>
                  <button className="btn-mini" onClick={() => alternar(c.id, !c.activa)}>
                    {c.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {claves.length === 0 && <tr><td colSpan={6} className="vacio">Sin claves creadas</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}

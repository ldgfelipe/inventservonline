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
  const [pagos, setPagos] = useState([]);
  const [pagosCargando, setPagosCargando] = useState(false);
  const [solicitudes, setSolicitudes] = useState([]);
  const [solicitudesCargando, setSolicitudesCargando] = useState(false);

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
    cargarPagos();
    cargarSolicitudes();
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

  async function cargarPagos() {
    setPagosCargando(true);
    try {
      const r = await fetch('/api/admin/pagos?estado=en_revision', { headers: auth() });
      const j = await r.json();
      if (r.ok) setPagos(j.pagos || []);
      else setError(j.error || 'No se pudieron cargar los pagos');
    } finally { setPagosCargando(false); }
  }

  async function resolverPago(id, accion) {
    setError('');
    setMensaje('');
    const r = await fetch('/api/admin/pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ id, accion }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo resolver');
    setMensaje(accion === 'aprobar' ? 'Pago aprobado y plan activado' : 'Pago rechazado');
    cargarPagos();
  }

  async function cargarSolicitudes() {
    setSolicitudesCargando(true);
    try {
      const r = await fetch('/api/admin/facturacion/solicitudes', { headers: auth() });
      const j = await r.json();
      if (r.ok) setSolicitudes(j.solicitudes || []);
      else setError(j.error || 'No se pudieron cargar las solicitudes');
    } finally { setSolicitudesCargando(false); }
  }

  async function resolverSolicitud(id, estado, notas) {
    setError('');
    setMensaje('');
    const r = await fetch('/api/admin/facturacion/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ id, estado, notas_admin: notas }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo actualizar');
    setMensaje('Solicitud actualizada: ' + estado);
    cargarSolicitudes();
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
          <p className="sub">Hola {usuario.nombre}. Gestiona claves, pagos y solicitudes de facturacion.</p>
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

      <section className="panel-admin">
        <h2>Pagos pendientes de revision</h2>
        <p className="ayuda">
          Transferencias bancarias y pagos manuales que esperan aprobacion.
        </p>
        <button className="btn btn-secundario" onClick={cargarPagos} style={{ marginBottom: 12 }}>
          {pagosCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        <table className="tabla-admin">
          <thead>
            <tr><th>Empresa</th><th>Plan</th><th>Pasarela</th><th>Monto</th><th>Comprobante</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>{p.empresa || p.empresa_id}</td>
                <td>{p.plan}</td>
                <td>{p.pasarela}</td>
                <td>{p.monto} {p.moneda}</td>
                <td>
                  {p.comprobante_url
                    ? <a href={p.comprobante_url} target="_blank" rel="noopener">Ver</a>
                    : '-'}
                </td>
                <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-VE') : '-'}</td>
                <td>
                  <button className="btn-mini" onClick={() => resolverPago(p.id, 'aprobar')}>Aprobar</button>
                  <button className="btn-mini" onClick={() => resolverPago(p.id, 'rechazar')}>Rechazar</button>
                </td>
              </tr>
            ))}
            {pagos.length === 0 && <tr><td colSpan={7} className="vacio">Sin pagos pendientes</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel-admin">
        <h2>Solicitudes de facturacion electronica</h2>
        <p className="ayuda">
          Solicitudes de usuarios para integrar proveedores o paises no soportados.
        </p>
        <button className="btn btn-secundario" onClick={cargarSolicitudes} style={{ marginBottom: 12 }}>
          {solicitudesCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        <table className="tabla-admin">
          <thead>
            <tr><th>Empresa</th><th>Pais</th><th>Proveedor</th><th>Descripcion</th><th>Estado</th><th>Notas</th><th></th></tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                <td>{s.empresa || s.empresa_id}</td>
                <td>{s.pais}</td>
                <td>{s.proveedor || '-'}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.descripcion || '-'}</td>
                <td>
                  <select
                    value={s.estado}
                    onChange={(e) => resolverSolicitud(s.id, e.target.value, s.notas_admin || '')}
                    className="input-select"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_investigacion">En investigacion</option>
                    <option value="implementado">Implementado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    defaultValue={s.notas_admin || ''}
                    onBlur={(e) => { if (e.target.value !== (s.notas_admin || '')) resolverSolicitud(s.id, s.estado, e.target.value); }}
                    placeholder="Notas..."
                    style={{ width: 120 }}
                  />
                </td>
                <td>
                  {s.estado !== 'implementado' && (
                    <button className="btn-mini" onClick={() => resolverSolicitud(s.id, 'implementado', s.notas_admin || '')}>
                      Marcar implementado
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {solicitudes.length === 0 && <tr><td colSpan={7} className="vacio">Sin solicitudes</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}

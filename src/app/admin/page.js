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
  const [marketing, setMarketing] = useState(null);
  const [marketingCargando, setMarketingCargando] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardCargando, setDashboardCargando] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [empresasCargando, setEmpresasCargando] = useState(false);
  const [featureFlags, setFeatureFlags] = useState([]);
  const [featureFlagsCargando, setFeatureFlagsCargando] = useState(false);

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
    cargarMarketing();
    cargarDashboard();
    cargarEmpresas();
    cargarFeatureFlags();
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

  async function cargarMarketing() {
    setMarketingCargando(true);
    try {
      const r = await fetch('/api/admin/marketing', { headers: auth() });
      const j = await r.json();
      if (r.ok) setMarketing(j);
      else setError(j.error || 'No se pudieron cargar las metricas de marketing');
    } finally { setMarketingCargando(false); }
  }

  async function cargarDashboard() {
    setDashboardCargando(true);
    try {
      const r = await fetch('/api/admin/dashboard', { headers: auth() });
      const j = await r.json();
      if (r.ok) setDashboard(j.metricas);
      else setError(j.error || 'No se pudieron cargar las metricas');
    } finally { setDashboardCargando(false); }
  }

  async function cargarEmpresas() {
    setEmpresasCargando(true);
    try {
      const r = await fetch('/api/admin/empresas', { headers: auth() });
      const j = await r.json();
      if (r.ok) setEmpresas(j.empresas || []);
      else setError(j.error || 'No se pudieron cargar las empresas');
    } finally { setEmpresasCargando(false); }
  }

  async function cargarFeatureFlags() {
    setFeatureFlagsCargando(true);
    try {
      const r = await fetch('/api/feature-flags', { headers: auth() });
      const j = await r.json();
      if (r.ok) {
        // Convertir objeto a array para la tabla
        const flags = j.flags || {};
        setFeatureFlags(Object.entries(flags).map(([k, v]) => ({ clave: k, activo: v })));
      }
    } finally { setFeatureFlagsCargando(false); }
  }

  async function toggleFeatureFlag(clave, activo) {
    setError('');
    setMensaje('');
    const r = await fetch('/api/feature-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ clave, activo }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo actualizar');
    setMensaje('Flag ' + clave + ' actualizado');
    cargarFeatureFlags();
  }

  async function gestionarEmpresa(id, accion, extra = {}) {
    setError('');
    setMensaje('');
    const r = await fetch('/api/admin/empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ id, accion, ...extra }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo gestionar');
    setMensaje(j.mensaje || 'Operacion exitosa');
    cargarEmpresas();
    cargarDashboard();
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
        <h2>Configuracion del sistema</h2>
        <p className="ayuda">
          Configuracion global de la plataforma. Solo visible para administradores generales.
        </p>
        <button className="btn btn-secundario" onClick={cargarFeatureFlags} style={{ marginBottom: 12 }}>
          {featureFlagsCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        <table className="tabla-admin">
          <thead>
            <tr><th>Flag</th><th>Estado</th><th>Accion</th></tr>
          </thead>
          <tbody>
            {featureFlags.map((f) => (
              <tr key={f.clave}>
                <td className="mono">{f.clave}</td>
                <td><span className={`estado ${f.activo ? 'verde' : 'rojo'}`}>{f.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <button className="btn-mini" onClick={() => toggleFeatureFlag(f.clave, !f.activo)}>
                    {f.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {featureFlags.length === 0 && <tr><td colSpan={3} className="vacio">Sin feature flags configurados</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel-admin">
        <h2>Dashboard del SaaS</h2>
        <p className="ayuda">Metricas generales de la plataforma.</p>
        <button className="btn btn-secundario" onClick={cargarDashboard} style={{ marginBottom: 12 }}>
          {dashboardCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        {dashboard && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="adopcion-card"><h4>Total empresas</h4><div className="valor">{dashboard.total_empresas}</div></div>
            <div className="adopcion-card"><h4>Plan Gratis</h4><div className="valor">{dashboard.por_plan.free}</div></div>
            <div className="adopcion-card"><h4>Plan Basico</h4><div className="valor">{dashboard.por_plan.basic}</div></div>
            <div className="adopcion-card"><h4>Plan Pro</h4><div className="valor">{dashboard.por_plan.pro}</div></div>
            <div className="adopcion-card"><h4>Plan Empresa</h4><div className="valor">{dashboard.por_plan.empresa}</div></div>
            <div className="adopcion-card"><h4>Activas</h4><div className="valor">{dashboard.por_estado.activo}</div></div>
            <div className="adopcion-card"><h4>En trial</h4><div className="valor">{dashboard.por_estado.trial}</div></div>
            <div className="adopcion-card"><h4>Vencidas</h4><div className="valor">{dashboard.por_estado.vencido}</div></div>
            <div className="adopcion-card"><h4>MRR (USD)</h4><div className="valor">${dashboard.mrr}</div></div>
            <div className="adopcion-card"><h4>ARR (USD)</h4><div className="valor">${dashboard.arr}</div></div>
            <div className="adopcion-card"><h4>Usuarios totales</h4><div className="valor">{dashboard.total_usuarios}</div></div>
            <div className="adopcion-card"><h4>Productos totales</h4><div className="valor">{dashboard.total_productos}</div></div>
            <div className="adopcion-card"><h4>Ventas totales</h4><div className="valor">{dashboard.total_ventas}</div></div>
            <div className="adopcion-card"><h4>Pagos pendientes</h4><div className="valor">{dashboard.pagos_pendientes}</div></div>
            <div className="adopcion-card"><h4>Tasa conversion</h4><div className="valor">{dashboard.tasa_conversion}%</div></div>
          </div>
        )}
      </section>

      <section className="panel-admin">
        <h2>Empresas registradas</h2>
        <p className="ayuda">Lista de todas las empresas con su plan, estado y uso. Puedes cambiar planes, extender trials, suspender o reactivar.</p>
        <button className="btn btn-secundario" onClick={cargarEmpresas} style={{ marginBottom: 12 }}>
          {empresasCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        <table className="tabla-admin">
          <thead>
            <tr><th>Empresa</th><th>Email</th><th>Giro</th><th>Plan</th><th>Estado</th><th>Productos</th><th>Usuarios</th><th>Ventas</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id}>
                <td>{e.nombre}</td>
                <td style={{ fontSize: 12 }}>{e.email}</td>
                <td style={{ fontSize: 12 }}>{e.giro}</td>
                <td>
                  <select
                    value={e.plan}
                    onChange={(ev) => gestionarEmpresa(e.id, 'cambiar_plan', { plan: ev.target.value, dias: 30 })}
                    className="input-select"
                    style={{ fontSize: 12, padding: 2 }}
                  >
                    <option value="free">Gratis</option>
                    <option value="basic">Basico</option>
                    <option value="pro">Pro</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </td>
                <td><span className={`estado ${e.estado === 'activo' ? 'verde' : e.estado === 'trial' ? 'amarillo' : 'rojo'}`}>{e.estado}</span></td>
                <td>{e.productos}</td>
                <td>{e.usuarios}</td>
                <td>{e.ventas}</td>
                <td>
                  {e.estado !== 'activo' && (
                    <button className="btn-mini" onClick={() => gestionarEmpresa(e.id, 'reactivar')}>Reactivar</button>
                  )}
                  {e.estado === 'activo' && (
                    <button className="btn-mini" onClick={() => gestionarEmpresa(e.id, 'suspender')}>Suspender</button>
                  )}
                  <button className="btn-mini" onClick={() => gestionarEmpresa(e.id, 'extender_trial', { dias: 14 })}>+14d trial</button>
                </td>
              </tr>
            ))}
            {empresas.length === 0 && <tr><td colSpan={9} className="vacio">Sin empresas</td></tr>}
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
        <h2>Marketing y conversion</h2>
        <p className="ayuda">
          Analisis de usuarios freemium, probabilidad de conversion, trafico por fuente y campanas.
        </p>
        <button className="btn btn-secundario" onClick={cargarMarketing} style={{ marginBottom: 12 }}>
          {marketingCargando ? 'Cargando...' : 'Actualizar'}
        </button>

        {marketing && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="adopcion-card"><h4>Total empresas</h4><div className="valor">{marketing.resumen.total_empresas}</div></div>
              <div className="adopcion-card"><h4>Freemium</h4><div className="valor">{marketing.resumen.freemium}</div></div>
              <div className="adopcion-card"><h4>Pagadas</h4><div className="valor">{marketing.resumen.pagadas}</div></div>
              <div className="adopcion-card"><h4>Score promedio</h4><div className="valor">{marketing.resumen.score_promedio}</div></div>
              <div className="adopcion-card"><h4>Alta probabilidad</h4><div className="valor">{marketing.resumen.alta_probabilidad}</div></div>
            </div>

            <h3 style={{ fontSize: 14, marginTop: 12 }}>Usuarios freemium (por probabilidad de conversion)</h3>
            <table className="tabla-admin">
              <thead>
                <tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Productos</th><th>Usuarios</th><th>Movs</th><th>Ventas</th><th>Dias</th><th>Score</th></tr>
              </thead>
              <tbody>
                {(marketing.freemium_users || []).sort((a, b) => b.score - a.score).slice(0, 30).map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.plan}</td>
                    <td>{u.suscripcion ? u.suscripcion.estado : '-'}</td>
                    <td>{u.productos}</td>
                    <td>{u.usuarios}</td>
                    <td>{u.movimientos}</td>
                    <td>{u.ventas}</td>
                    <td>{u.dias_registro}</td>
                    <td><strong style={{ color: u.score >= 60 ? '#16a34a' : u.score >= 30 ? '#d97706' : '#dc2626' }}>{u.score}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ fontSize: 14, marginTop: 16 }}>Trafico por fuente</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {Object.entries(marketing.traffic?.por_fuente || {}).map(([k, v]) => (
                <div key={k} className="adopcion-card" style={{ minWidth: 100 }}>
                  <h4>{k}</h4><div className="valor">{v}</div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 14, marginTop: 12 }}>Campanas</h3>
            <table className="tabla-admin">
              <thead><tr><th>Nombre</th><th>Tipo</th><th>Canal</th><th>Estado</th><th>Presupuesto</th><th>Inicio</th><th>Fin</th></tr></thead>
              <tbody>
                {(marketing.campanas || []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{c.tipo}</td>
                    <td>{c.canal || '-'}</td>
                    <td>{c.estado}</td>
                    <td>{c.presupuesto} {c.moneda}</td>
                    <td>{c.fecha_inicio || '-'}</td>
                    <td>{c.fecha_fin || '-'}</td>
                  </tr>
                ))}
                {(marketing.campanas || []).length === 0 && <tr><td colSpan={7} className="vacio">Sin campanas</td></tr>}
              </tbody>
            </table>

            <h3 style={{ fontSize: 14, marginTop: 16 }}>Landing pages</h3>
            <table className="tabla-admin">
              <thead><tr><th>Nombre</th><th>Slug</th><th>Visitas</th><th>Conversiones</th><th>Publicada</th></tr></thead>
              <tbody>
                {(marketing.landings || []).map((l) => (
                  <tr key={l.id}>
                    <td>{l.nombre}</td>
                    <td className="mono">{l.slug}</td>
                    <td>{l.visitas}</td>
                    <td>{l.conversiones}</td>
                    <td>{l.publicada ? 'Si' : 'No'}</td>
                  </tr>
                ))}
                {(marketing.landings || []).length === 0 && <tr><td colSpan={5} className="vacio">Sin landing pages</td></tr>}
              </tbody>
            </table>

            <h3 style={{ fontSize: 14, marginTop: 16 }}>Pixeles de tracking</h3>
            <table className="tabla-admin">
              <thead><tr><th>Nombre</th><th>Plataforma</th><th>Pixel ID</th><th>Activo</th><th>Global</th></tr></thead>
              <tbody>
                {(marketing.pixeles || []).map((px) => (
                  <tr key={px.id}>
                    <td>{px.nombre}</td>
                    <td>{px.plataforma}</td>
                    <td className="mono">{px.pixel_id}</td>
                    <td>{px.activo ? 'Si' : 'No'}</td>
                    <td>{px.global ? 'Si' : 'No'}</td>
                  </tr>
                ))}
                {(marketing.pixeles || []).length === 0 && <tr><td colSpan={5} className="vacio">Sin pixeles</td></tr>}
              </tbody>
            </table>
          </>
        )}
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

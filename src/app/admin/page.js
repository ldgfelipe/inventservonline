'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { asegurarSesion } from '@/lib/sesionCliente';
import LanguageToggle from '@/components/LanguageToggle';

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
  const [tickets, setTickets] = useState([]);
  const [ticketsCargando, setTicketsCargando] = useState(false);
  const [tab, setTab] = useState('general');
  const [configPagos, setConfigPagos] = useState(null);
  const [configPagosCargando, setConfigPagosCargando] = useState(false);
  const [configPagosMensaje, setConfigPagosMensaje] = useState('');
  const [paginas, setPaginas] = useState([]);
  const [paginasCargando, setPaginasCargando] = useState(false);
  const [paginaEditando, setPaginaEditando] = useState(null);
  const [paginaModal, setPaginaModal] = useState(false);
  const [marketingTab, setMarketingTab] = useState('resumen');
  const [pagFreemium, setPagFreemium] = useState(1);
  const [pixelesConfig, setPixelesConfig] = useState(null);
  const [pixelesCargando, setPixelesCargando] = useState(false);
  const [pixelesMensaje, setPixelesMensaje] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosCargando, setUsuariosCargando] = useState(false);
  const [usuarioDetalle, setUsuarioDetalle] = useState(null);
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', password: '', rol: 'admin', area: 'Administracion', super_admin: false });
  const [filtroUsuarios, setFiltroUsuarios] = useState({ texto: '', empresa: '', rol: '', estado: '' });
  const [storageData, setStorageData] = useState(null);
  const [storageCargando, setStorageCargando] = useState(false);

  useEffect(() => {
    (async () => {
      // Renueva la sesion si el access token expiro (la sesion dura hasta
      // cerrar sesion o ser bloqueado).
      await asegurarSesion();
      try {
        const r = await fetch('/api/auth/sesion', { headers: auth() });
        const j = r.ok ? await r.json() : null;
        setUsuario(j ? j.usuario : null);
      } catch {
        setUsuario(null);
      } finally {
        setCargandoSesion(false);
      }
    })();
    // Mantiene el token fresco durante sesiones largas en /admin.
    const intervalo = setInterval(() => { asegurarSesion(); }, 30 * 60 * 1000);
    return () => clearInterval(intervalo);
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
    cargarTickets();
    cargarConfigPagos();
    cargarPaginas();
    cargarPixeles();
    cargarUsuariosAdmin();
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
      const r = await fetch('/api/feature-flags?admin=1', { headers: auth() });
      const j = await r.json();
      if (r.ok) setFeatureFlags(j.flags || []);
      else setError(j.error || 'No se pudieron cargar los feature flags');
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

  async function crearFeatureFlag() {
    setError('');
    setMensaje('');
    const clave = document.getElementById('nuevoFlagClave').value.trim();
    const descripcion = document.getElementById('nuevoFlagDesc').value.trim();
    const porcentaje = Number(document.getElementById('nuevoFlagPct').value) || 100;
    if (!clave) return setError('Escribe la clave del flag');
    const r = await fetch('/api/feature-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ clave, descripcion, porcentaje, activo: true }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo crear');
    setMensaje('Flag ' + clave + ' creado');
    document.getElementById('nuevoFlagClave').value = '';
    document.getElementById('nuevoFlagDesc').value = '';
    cargarFeatureFlags();
  }

  async function cargarTickets() {
    setTicketsCargando(true);
    try {
      const r = await fetch('/api/soporte', { headers: auth() });
      const j = await r.json();
      if (r.ok) setTickets(j.tickets || []);
      else setError(j.error || 'No se pudieron cargar los tickets');
    } finally { setTicketsCargando(false); }
  }

  async function responderTicket(id, estado, respuesta) {
    setError('');
    setMensaje('');
    const r = await fetch('/api/soporte', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ id, estado, respuesta }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo responder');
    setMensaje('Ticket actualizado');
    cargarTickets();
  }

  async function cargarConfigPagos() {
    setConfigPagosCargando(true);
    try {
      const r = await fetch('/api/admin/config-pagos', { headers: auth() });
      const j = await r.json();
      if (r.ok) setConfigPagos(j.config || {});
      else setError(j.error || 'No se pudo cargar la configuracion de pagos');
    } finally { setConfigPagosCargando(false); }
  }

  async function probarPasarela(pasarela) {
    setError('');
    setMensaje('');
    setConfigPagosMensaje('');
    const r = await fetch('/api/admin/config-pagos/probar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ pasarela }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || `No se pudo probar ${pasarela}`);
    setConfigPagosMensaje(j.mensaje || `${pasarela} OK`);
  }

  async function cargarPaginas() {
    setPaginasCargando(true);
    try {
      const r = await fetch('/api/admin/paginas', { headers: auth() });
      const j = await r.json();
      if (r.ok) setPaginas(j.paginas || []);
      else setError(j.error || 'No se pudieron cargar las paginas');
    } finally { setPaginasCargando(false); }
  }

  function abrirNuevaPagina() {
    setPaginaEditando({ slug: '', titulo: '', tipo: 'landing', html: '', publicado: false });
    setPaginaModal(true);
  }

  function abrirEditarPagina(p) {
    setPaginaEditando({ ...p, html: '' });
    setPaginaModal(true);
    // Cargar el HTML completo
    fetch('/api/admin/paginas/' + p.id, { headers: auth() })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setPaginaEditando(j.pagina); })
      .catch(() => {});
  }

  async function guardarPagina(e) {
    e.preventDefault();
    if (!paginaEditando) return;
    setError(''); setMensaje('');
    const payload = {
      slug: paginaEditando.slug,
      titulo: paginaEditando.titulo,
      tipo: paginaEditando.tipo,
      html: paginaEditando.html,
      publicado: paginaEditando.publicado,
    };
    const url = paginaEditando.id ? '/api/admin/paginas/' + paginaEditando.id : '/api/admin/paginas';
    const metodo = paginaEditando.id ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo guardar la pagina');
    setMensaje('Pagina guardada correctamente');
    setPaginaModal(false);
    setPaginaEditando(null);
    cargarPaginas();
  }

  async function eliminarPagina(id) {
    if (!confirm('¿Eliminar esta pagina? Esta accion no se puede deshacer.')) return;
    setError(''); setMensaje('');
    const r = await fetch('/api/admin/paginas/' + id, { method: 'DELETE', headers: auth() });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo eliminar');
    setMensaje('Pagina eliminada');
    cargarPaginas();
  }

  async function cargarPixeles() {
    setPixelesCargando(true);
    try {
      const r = await fetch('/api/admin/pixeles', { headers: auth() });
      const j = await r.json();
      if (r.ok) {
        setPixelesConfig(j.config || {});
        if (j.aviso) setPixelesMensaje(j.aviso);
      } else {
        setError(j.error || 'No se pudo cargar la configuracion de pixeles');
      }
    } finally { setPixelesCargando(false); }
  }

  async function guardarPixeles(e) {
    e.preventDefault();
    setError(''); setMensaje(''); setPixelesMensaje('');
    const form = e.target;
    const payload = {
      ga_measurement_id: form.elements.ga_measurement_id.value.trim(),
      gtm_id: form.elements.gtm_id.value.trim(),
      head_code: form.elements.head_code.value,
      body_open_code: form.elements.body_open_code.value,
      body_close_code: form.elements.body_close_code.value,
    };
    const r = await fetch('/api/admin/pixeles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo guardar');
    setPixelesMensaje('Configuracion guardada. Los cambios se aplican al recargar el sitio.');
    cargarPixeles();
  }

  async function cargarUsuariosAdmin() {
    setUsuariosCargando(true);
    try {
      const r = await fetch('/api/admin/usuarios', { headers: auth() });
      const j = await r.json();
      if (r.ok) setUsuarios(j.usuarios || []);
      else setError(j.error || 'No se pudieron cargar los usuarios');
    } finally { setUsuariosCargando(false); }
  }

  async function crearUsuarioAdmin(e) {
    e.preventDefault();
    setError('');
    setMensaje('');
    const r = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(nuevoUsuario),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo crear el usuario');
    setMensaje('Usuario creado correctamente');
    setNuevoUsuario({ nombre: '', email: '', password: '', rol: 'admin', area: 'Administracion', super_admin: false });
    cargarUsuariosAdmin();
  }

  async function actualizarUsuarioAdmin(id, cambios) {
    setError('');
    setMensaje('');
    const r = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ id, ...cambios }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo actualizar el usuario');
    setMensaje('Usuario actualizado');
    cargarUsuariosAdmin();
  }

  async function verUsuario(id) {
    setUsuarioDetalle(null);
    try {
      const r = await fetch('/api/admin/usuarios/' + id, { headers: auth() });
      const j = await r.json();
      if (r.ok) setUsuarioDetalle(j);
      else setError(j.error || 'No se pudo cargar el detalle');
    } catch (err) { setError(err.message); }
  }

  async function resetPasswordUsuario(id) {
    const pass = prompt('Nueva contrasena para el usuario (minimo 6 caracteres):');
    if (!pass) return;
    await actualizarUsuarioAdmin(id, { password: pass });
  }

  async function bloquearUsuario(u) {
    if (u.activo) {
      const motivo = prompt('Motivo del bloqueo (opcional):') || '';
      await actualizarUsuarioAdmin(u.id, { activo: false, motivo });
    } else {
      await actualizarUsuarioAdmin(u.id, { activo: true, motivo: '' });
    }
  }

  async function cargarStorage() {
    setStorageCargando(true);
    setError('');
    try {
      const r = await fetch('/api/admin/storage', { headers: auth() });
      const j = await r.json();
      if (r.ok) setStorageData(j);
      else setError(j.error || 'No se pudo analizar el storage');
    } finally { setStorageCargando(false); }
  }

  async function limpiarHuerfanos() {
    if (!storageData || !storageData.huerfanos || !storageData.huerfanos.length) {
      return setMensaje('No hay archivos huerfanos');
    }
    if (!confirm(`Se eliminaran ${storageData.huerfanos.length} archivos huerfanos (${(storageData.huerfanos_bytes / 1024 / 1024).toFixed(2)} MB). ¿Continuar?`)) return;
    setError(''); setMensaje('');
    const r = await fetch('/api/admin/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ accion: 'limpiar_huerfanos', rutas: storageData.huerfanos.map((h) => h.ruta) }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo limpiar');
    setMensaje(`Archivos eliminados: ${j.eliminados}. Omitidos: ${(j.omitidos || []).length}.`);
    cargarStorage();
    cargarDashboard();
  }

  async function exportarUsuarios(lista) {
    setError('');
    setMensaje('');
    const filas = lista.map((u) => ({
      nombre: u.nombre,
      email: u.email || '',
      empresa: u.empresa || '',
      plan: u.plan || '',
      rol: u.rol,
      super_admin: u.super_admin ? 'Si' : 'No',
      productos: u.productos,
      movimientos: u.movimientos,
      ventas: u.ventas,
      archivos: u.archivos,
      estado: u.activo ? 'Activo' : 'Bloqueado',
    }));
    const columnas = [
      { campo: 'nombre', titulo: 'Nombre', ancho: 24 },
      { campo: 'email', titulo: 'Email', ancho: 28 },
      { campo: 'empresa', titulo: 'Empresa', ancho: 24 },
      { campo: 'plan', titulo: 'Plan', ancho: 10 },
      { campo: 'rol', titulo: 'Rol', ancho: 12 },
      { campo: 'super_admin', titulo: 'Super-admin', ancho: 12 },
      { campo: 'productos', titulo: 'Productos', ancho: 10 },
      { campo: 'movimientos', titulo: 'Movimientos', ancho: 12 },
      { campo: 'ventas', titulo: 'Ventas', ancho: 10 },
      { campo: 'archivos', titulo: 'Archivos', ancho: 10 },
      { campo: 'estado', titulo: 'Estado', ancho: 12 },
    ];
    const r = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify({ filas, columnas, nombreArchivo: 'usuarios_plataforma.xlsx', hoja: 'Usuarios' }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) return setError(j.error || 'No se pudo exportar');
    const binario = atob(j.contenido);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: j.tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = j.archivo || 'usuarios_plataforma.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    setMensaje('Exportacion generada');
  }

  async function guardarConfigPagos(e) {
    e.preventDefault();
    setError('');
    setMensaje('');
    setConfigPagosMensaje('');
    const form = e.target;
    const payload = {};
    // Campos no secretos
    ['paypal_mode', 'transferencia_banco', 'transferencia_cuenta', 'transferencia_titular', 'transferencia_rif', 'transferencia_instrucciones', 'transferencia_qr_url']
      .forEach((k) => { payload[k] = form.elements[k].value; });
    // Secretos (solo si vienen con valor)
    ['stripe_secret_key', 'stripe_webhook_secret', 'mercadopago_access_token', 'mercadopago_webhook_secret', 'paypal_client_id', 'paypal_secret', 'paypal_webhook_id']
      .forEach((k) => { if (form.elements[k] && form.elements[k].value.trim()) payload[k] = form.elements[k].value.trim(); });
    // Interruptores de medios de pago
    ['stripe_activo', 'mercadopago_activo', 'paypal_activo', 'transferencia_activa']
      .forEach((k) => { if (form.elements[k]) payload[k] = form.elements[k].checked; });

    const r = await fetch('/api/admin/config-pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || 'No se pudo guardar');
    setConfigPagosMensaje(j.aviso || 'Configuracion de pagos guardada correctamente');
    form.reset();
    cargarConfigPagos();
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

  // Lista filtrada de usuarios
  const usuariosFiltrados = usuarios.filter((u) => {
    const t = filtroUsuarios.texto.trim().toLowerCase();
    if (t && !String(u.nombre || '').toLowerCase().includes(t) && !String(u.email || '').toLowerCase().includes(t)) return false;
    if (filtroUsuarios.empresa && u.empresa !== filtroUsuarios.empresa) return false;
    if (filtroUsuarios.rol && u.rol !== filtroUsuarios.rol) return false;
    if (filtroUsuarios.estado === 'activo' && !u.activo) return false;
    if (filtroUsuarios.estado === 'bloqueado' && u.activo) return false;
    if (filtroUsuarios.estado === 'super' && !u.super_admin) return false;
    return true;
  });
  const empresasNombres = Array.from(new Set(usuarios.map((u) => u.empresa).filter(Boolean))).sort();

  // Paginacion de la tabla de freemium
  const freemiumOrden = marketing ? (marketing.freemium_users || []).slice().sort((a, b) => b.score - a.score) : [];
  const freemiumPag = paginar(freemiumOrden, pagFreemium);

  return (
    <main className="admin admin-ancho" data-tab={tab}>
      <header className="admin-header">
        <div>
          <h1>Administracion</h1>
          <p className="sub">Hola {usuario.nombre}. Panel general de la plataforma.</p>
        </div>
        <LanguageToggle />
        <Link className="btn btn-secundario" href="/panel">Ir al sistema</Link>
      </header>

      {mensaje && <div className="mensaje ok">{mensaje}</div>}
      {error && <div className="mensaje error">{error}</div>}
      {configPagosMensaje && <div className="mensaje ok">{configPagosMensaje}</div>}

      <nav className="admin-tabs">
        {[
          ['general', 'General'],
          ['usuarios', 'Usuarios'],
          ['pagos', 'Pagos'],
          ['paginas', 'Paginas'],
          ['marketing', 'Marketing'],
          ['soporte', 'Soporte'],
          ['sistema', 'Sistema'],
        ].map(([id, nombre]) => (
          <button
            key={id}
            className={`admin-tab ${tab === id ? 'activo' : ''}`}
            onClick={() => setTab(id)}
          >
            {nombre}
          </button>
        ))}
      </nav>

      <section className="panel-admin sec-sistema">
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

      <section className="panel-admin sec-sistema">
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

      <section className="panel-admin sec-soporte">
        <h2>Tickets de soporte</h2>
        <p className="ayuda">Solicitudes de ayuda enviadas por los usuarios de las empresas.</p>
        <button className="btn btn-secundario" onClick={cargarTickets} style={{ marginBottom: 12 }}>
          {ticketsCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        <table className="tabla-admin">
          <thead>
            <tr><th>Empresa</th><th>Usuario</th><th>Asunto</th><th>Categoria</th><th>Prioridad</th><th>Estado</th><th>Respuesta</th><th>Accion</th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td style={{ fontSize: 12 }}>{t.empresa_id ? t.empresa_id.slice(0, 8) + '...' : '-'}</td>
                <td style={{ fontSize: 12 }}>{t.usuario || '-'}</td>
                <td>{t.asunto}</td>
                <td style={{ fontSize: 12 }}>{t.categoria}</td>
                <td><span className={`estado ${t.prioridad === 'urgente' || t.prioridad === 'alta' ? 'rojo' : 'verde'}`}>{t.prioridad}</span></td>
                <td>{t.estado}</td>
                <td>
                  <input
                    type="text"
                    defaultValue={t.respuesta || ''}
                    placeholder="Escribe respuesta..."
                    onBlur={(e) => { if (e.target.value !== (t.respuesta || '')) responderTicket(t.id, t.estado, e.target.value); }}
                    style={{ width: 160, fontSize: 12 }}
                  />
                </td>
                <td>
                  <select
                    value={t.estado}
                    onChange={(e) => responderTicket(t.id, e.target.value, t.respuesta || '')}
                    className="input-select"
                    style={{ fontSize: 12, padding: 2 }}
                  >
                    <option value="abierto">Abierto</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={8} className="vacio">Sin tickets</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel-admin sec-sistema">
        <h2>Configuracion del sistema</h2>
        <p className="ayuda">
          Configuracion global de la plataforma. Solo visible para administradores generales.
        </p>
        <button className="btn btn-secundario" onClick={cargarFeatureFlags} style={{ marginBottom: 12 }}>
          {featureFlagsCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        <table className="tabla-admin">
          <thead>
            <tr><th>Flag</th><th>Descripcion</th><th>Rollout</th><th>Empresas beta</th><th>Estado</th><th>Accion</th></tr>
          </thead>
          <tbody>
            {featureFlags.map((f) => (
              <tr key={f.clave}>
                <td className="mono">{f.clave}</td>
                <td style={{ fontSize: 12 }}>{f.descripcion || '-'}</td>
                <td>{f.porcentaje != null ? f.porcentaje + '%' : '-'}</td>
                <td style={{ fontSize: 12 }}>{f.empresas && f.empresas.length ? f.empresas.length + ' empresa(s)' : 'Todas'}</td>
                <td><span className={`estado ${f.activo ? 'verde' : 'rojo'}`}>{f.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <button className="btn-mini" onClick={() => toggleFeatureFlag(f.clave, !f.activo)}>
                    {f.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {featureFlags.length === 0 && <tr><td colSpan={6} className="vacio">Sin feature flags configurados</td></tr>}
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input id="nuevoFlagClave" placeholder="clave_del_flag" className="input-select" style={{ fontSize: 12 }} />
          <input id="nuevoFlagDesc" placeholder="Descripcion" className="input-select" style={{ fontSize: 12 }} />
          <input id="nuevoFlagPct" type="number" min="0" max="100" defaultValue="100" className="input-select" style={{ fontSize: 12, width: 90 }} />
          <button className="btn btn-secundario" onClick={crearFeatureFlag}>Crear flag</button>
        </div>
      </section>

      <section className="panel-admin sec-sistema">
        <h2>Storage por empresa</h2>
        <p className="ayuda">
          Ranking de espacio usado por cada empresa y deteccion de archivos huerfanos
          (archivos sin registro en la base). Los comprobantes de pago se conservan siempre.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secundario" onClick={cargarStorage}>
            {storageCargando ? 'Analizando...' : 'Analizar storage'}
          </button>
          <button className="btn btn-secundario" onClick={limpiarHuerfanos}>
            Limpiar huerfanos
          </button>
        </div>
        {storageData && (
          <>
            <p style={{ fontSize: 13 }}>
              Total: <strong>{storageData.total_mb} MB</strong> en {storageData.total_archivos} archivos ·
              Huerfanos: <strong>{(storageData.huerfanos_bytes / 1024 / 1024).toFixed(2)} MB</strong> ({storageData.huerfanos.length})
            </p>
            <table className="tabla-admin">
              <thead><tr><th>#</th><th>Empresa</th><th>Archivos</th><th>Espacio (MB)</th><th>%</th></tr></thead>
              <tbody>
                {storageData.ranking.map((r, i) => (
                  <tr key={r.empresa_id}>
                    <td>{i + 1}</td>
                    <td>{r.empresa}</td>
                    <td>{r.archivos}</td>
                    <td>{r.mb}</td>
                    <td>{storageData.total_bytes > 0 ? Math.round((r.bytes / storageData.total_bytes) * 100) : 0}%</td>
                  </tr>
                ))}
                {storageData.ranking.length === 0 && <tr><td colSpan={5} className="vacio">Sin archivos</td></tr>}
              </tbody>
            </table>
            {storageData.huerfanos.length > 0 && (
              <>
                <h4 style={{ fontSize: 13, margin: '14px 0 4px' }}>Archivos huerfanos detectados</h4>
                <table className="tabla-admin">
                  <thead><tr><th>Ruta</th><th>KB</th></tr></thead>
                  <tbody>
                    {storageData.huerfanos.slice(0, 50).map((h) => (
                      <tr key={h.ruta}>
                        <td className="mono" style={{ fontSize: 11 }}>{h.ruta}</td>
                        <td>{(h.bytes / 1024).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {storageData.huerfanos.length > 50 && (
                  <p className="ayuda">Mostrando 50 de {storageData.huerfanos.length}. Se eliminaran todos al pulsar "Limpiar huerfanos".</p>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="panel-admin sec-general">
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
            <div className="adopcion-card"><h4>Storage total</h4><div className="valor">{dashboard.storage_total_mb} MB</div></div>
          </div>
        )}
      </section>

      <section className="panel-admin sec-general">
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

      <section className="panel-admin sec-usuarios">
        <h2>Usuarios de la plataforma</h2>
        <p className="ayuda">
          Administra a todos los usuarios registrados: crea administradores, bloquea/desbloquea,
          cambia roles y consulta su desempeno y espacio usado.
        </p>
        <button className="btn btn-secundario" onClick={cargarUsuariosAdmin} style={{ marginBottom: 12 }}>
          {usuariosCargando ? 'Cargando...' : 'Actualizar'}
        </button>
        <button className="btn btn-secundario" onClick={() => exportarUsuarios(usuariosFiltrados)} style={{ marginBottom: 12, marginLeft: 8 }}>
          Exportar Excel
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
          <input
            placeholder="Buscar por nombre o email..."
            value={filtroUsuarios.texto}
            onChange={(e) => setFiltroUsuarios((f) => ({ ...f, texto: e.target.value }))}
          />
          <select value={filtroUsuarios.empresa} onChange={(e) => setFiltroUsuarios((f) => ({ ...f, empresa: e.target.value }))}>
            <option value="">Todas las empresas</option>
            {empresasNombres.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroUsuarios.rol} onChange={(e) => setFiltroUsuarios((f) => ({ ...f, rol: e.target.value }))}>
            <option value="">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="supervisor">Supervisor</option>
            <option value="almacenista">Almacenista</option>
            <option value="consultor">Consultor</option>
          </select>
          <select value={filtroUsuarios.estado} onChange={(e) => setFiltroUsuarios((f) => ({ ...f, estado: e.target.value }))}>
            <option value="">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="bloqueado">Bloqueados</option>
            <option value="super">Solo super-admin</option>
          </select>
        </div>
        <p className="ayuda" style={{ marginBottom: 8 }}>
          Mostrando {usuariosFiltrados.length} de {usuarios.length} usuarios.
        </p>

        <form onSubmit={crearUsuarioAdmin} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16, alignItems: 'end' }}>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Nombre</label>
            <input value={nuevoUsuario.nombre} onChange={(e) => setNuevoUsuario((u) => ({ ...u, nombre: e.target.value }))} required />
          </div>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input type="email" value={nuevoUsuario.email} onChange={(e) => setNuevoUsuario((u) => ({ ...u, email: e.target.value }))} required />
          </div>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Contrasena</label>
            <input type="password" value={nuevoUsuario.password} onChange={(e) => setNuevoUsuario((u) => ({ ...u, password: e.target.value }))} required />
          </div>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Rol</label>
            <select value={nuevoUsuario.rol} onChange={(e) => setNuevoUsuario((u) => ({ ...u, rol: e.target.value }))}>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="almacenista">Almacenista</option>
              <option value="consultor">Consultor</option>
            </select>
          </div>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Area</label>
            <select value={nuevoUsuario.area} onChange={(e) => setNuevoUsuario((u) => ({ ...u, area: e.target.value }))}>
              <option value="Administracion">Administracion</option>
              <option value="Almacen">Almacen</option>
              <option value="Compras">Compras</option>
              <option value="Ventas">Ventas</option>
              <option value="Contabilidad">Contabilidad</option>
            </select>
          </div>
          <label className="check-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={nuevoUsuario.super_admin} onChange={(e) => setNuevoUsuario((u) => ({ ...u, super_admin: e.target.checked }))} />
            Super-admin
          </label>
          <button type="submit" className="btn">Crear usuario</button>
        </form>

        <table className="tabla-admin">
          <thead>
            <tr>
              <th>Nombre</th><th>Email</th><th>Empresa</th><th>Plan</th><th>Rol</th><th>Super</th>
              <th>Prods</th><th>Movs</th><th>Ventas</th><th>Archivos</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td style={{ fontSize: 12 }}>{u.email || '-'}</td>
                <td style={{ fontSize: 12 }}>{u.empresa || '-'}</td>
                <td style={{ fontSize: 12 }}>{u.plan || '-'}</td>
                <td style={{ fontSize: 12 }}>{u.rol}</td>
                <td>{u.super_admin ? 'Si' : 'No'}</td>
                <td>{u.productos}</td>
                <td>{u.movimientos}</td>
                <td>{u.ventas}</td>
                <td>{u.archivos}</td>
                <td><span className={`estado ${u.activo ? 'verde' : 'rojo'}`}>{u.activo ? 'Activo' : 'Bloqueado'}</span></td>
                <td>
                  <button className="btn-mini" onClick={() => verUsuario(u.id)}>Detalle</button>
                  <button className="btn-mini" onClick={() => bloquearUsuario(u)}>
                    {u.activo ? 'Bloquear' : 'Desbloquear'}
                  </button>
                  <button className="btn-mini" onClick={() => resetPasswordUsuario(u.id)}>Clave</button>
                  <button className="btn-mini" onClick={() => actualizarUsuarioAdmin(u.id, { super_admin: !u.super_admin })}>
                    {u.super_admin ? 'Quitar super' : 'Hacer super'}
                  </button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && <tr><td colSpan={12} className="vacio">Sin usuarios</td></tr>}
          </tbody>
        </table>

        {usuarioDetalle && (
          <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid var(--borde)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>Detalle: {usuarioDetalle.usuario.nombre}</h3>
              <button className="btn-mini" onClick={() => setUsuarioDetalle(null)}>Cerrar</button>
            </div>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              Email: {usuarioDetalle.usuario.email || '-'} · Rol: {usuarioDetalle.usuario.rol} · Area: {usuarioDetalle.usuario.area} ·{' '}
              {usuarioDetalle.usuario.super_admin ? 'Super-admin' : 'Usuario de empresa'} ·{' '}
              {usuarioDetalle.usuario.activo ? 'Activo' : 'Bloqueado'}
            </p>
            <p style={{ fontSize: 13 }}>
              Empresa: {usuarioDetalle.empresa ? usuarioDetalle.empresa.nombre : '-'} · Plan: {usuarioDetalle.empresa ? usuarioDetalle.empresa.plan : '-'} ·{' '}
              Pais: {usuarioDetalle.empresa ? usuarioDetalle.empresa.pais : '-'} · Moneda: {usuarioDetalle.empresa ? usuarioDetalle.empresa.moneda : '-'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, margin: '10px 0' }}>
              <div className="adopcion-card"><h4>Productos</h4><div className="valor">{usuarioDetalle.uso.productos}</div></div>
              <div className="adopcion-card"><h4>Movimientos</h4><div className="valor">{usuarioDetalle.uso.movimientos}</div></div>
              <div className="adopcion-card"><h4>Ventas</h4><div className="valor">{usuarioDetalle.uso.ventas}</div></div>
              <div className="adopcion-card"><h4>Usuarios empresa</h4><div className="valor">{usuarioDetalle.uso.usuarios}</div></div>
              <div className="adopcion-card"><h4>Archivos</h4><div className="valor">{usuarioDetalle.uso.adjuntos}</div></div>
              <div className="adopcion-card"><h4>Storage</h4><div className="valor">{usuarioDetalle.uso.storage_mb} MB</div></div>
            </div>
            <h4 style={{ fontSize: 13, margin: '10px 0 4px' }}>Ultima actividad</h4>
            <table className="tabla-admin">
              <thead><tr><th>Fecha</th><th>Accion</th><th>Entidad</th><th>Detalle</th></tr></thead>
              <tbody>
                {(usuarioDetalle.actividad || []).map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}>{a.fecha ? new Date(a.fecha).toLocaleString('es-VE') : '-'}</td>
                    <td style={{ fontSize: 12 }}>{a.accion}</td>
                    <td style={{ fontSize: 12 }}>{a.entidad || '-'}</td>
                    <td style={{ fontSize: 12 }}>{a.detalle || '-'}</td>
                  </tr>
                ))}
                {(usuarioDetalle.actividad || []).length === 0 && <tr><td colSpan={4} className="vacio">Sin actividad registrada</td></tr>}
              </tbody>
            </table>

            <h4 style={{ fontSize: 13, margin: '12px 0 4px' }}>Historial de bloqueos</h4>
            <table className="tabla-admin">
              <thead><tr><th>Fecha</th><th>Accion</th><th>Motivo</th><th>Realizado por</th></tr></thead>
              <tbody>
                {(usuarioDetalle.bloqueos || []).map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}>{b.created_at ? new Date(b.created_at).toLocaleString('es-VE') : '-'}</td>
                    <td style={{ fontSize: 12 }}>{b.accion}</td>
                    <td style={{ fontSize: 12 }}>{b.motivo || '-'}</td>
                    <td style={{ fontSize: 12 }}>{b.realizado_por_nombre || '-'}</td>
                  </tr>
                ))}
                {(usuarioDetalle.bloqueos || []).length === 0 && <tr><td colSpan={4} className="vacio">Sin bloqueos registrados</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel-admin sec-pagos">
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

      <section className="panel-admin sec-pagos">
        <h2>Configuracion de pagos</h2>
        <p className="ayuda">
          Claves de las pasarelas y datos de transferencia bancaria. Los campos secretos
          solo se actualizan si escribes un valor nuevo. Deja vacio para conservar el actual.
          Desactiva un medio para ocultarlo a los usuarios y bloquear pagos nuevos por esa via.
        </p>
        {configPagosCargando && <p className="ayuda">Cargando...</p>}
        <form
          key={`pagos-${configPagos?.stripe_activo}-${configPagos?.mercadopago_activo}-${configPagos?.paypal_activo}-${configPagos?.transferencia_activa}`}
          onSubmit={guardarConfigPagos}
        >
          <h3 style={{ fontSize: 14, marginTop: 8 }}>Stripe</h3>
          <label className="check-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" name="stripe_activo" defaultChecked={configPagos?.stripe_activo !== false} />
            Habilitar Stripe como medio de pago
          </label>
          {configPagos?.stripe_activo !== false && !configPagos?.tiene_stripe && (
            <p className="ayuda" style={{ color: '#b45309', marginBottom: 8 }}>
              Habilitado, pero sin Secret key: no se mostrara a los usuarios hasta guardarla.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            <div className="campo">
              <label>Secret key {configPagos?.tiene_stripe ? '(configurada)' : ''}</label>
              <input name="stripe_secret_key" type="password" placeholder={configPagos?.tiene_stripe ? '••••••••' : 'sk_...'} />
            </div>
            <div className="campo">
              <label>Webhook secret {configPagos?.tiene_stripe_webhook ? '(configurado)' : ''}</label>
              <input name="stripe_webhook_secret" type="password" placeholder={configPagos?.tiene_stripe_webhook ? '••••••••' : 'whsec_...'} />
            </div>
          </div>
          <button type="button" className="btn btn-secundario" onClick={() => probarPasarela('stripe')} style={{ marginBottom: 8 }}>
            Probar credenciales de Stripe
          </button>

          <h3 style={{ fontSize: 14, marginTop: 8 }}>Mercado Pago</h3>
          <label className="check-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" name="mercadopago_activo" defaultChecked={configPagos?.mercadopago_activo !== false} />
            Habilitar Mercado Pago como medio de pago
          </label>
          {configPagos?.mercadopago_activo !== false && !configPagos?.tiene_mercadopago && (
            <p className="ayuda" style={{ color: '#b45309', marginBottom: 8 }}>
              Habilitado, pero sin Access token: no se mostrara a los usuarios hasta guardarlo.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            <div className="campo">
              <label>Access token {configPagos?.tiene_mercadopago ? '(configurado)' : ''}</label>
              <input name="mercadopago_access_token" type="password" placeholder={configPagos?.tiene_mercadopago ? '••••••••' : 'APP_USR-...'} />
            </div>
            <div className="campo">
              <label>Webhook secret {configPagos?.tiene_mercadopago_webhook ? '(configurado)' : ''}</label>
              <input name="mercadopago_webhook_secret" type="password" placeholder={configPagos?.tiene_mercadopago_webhook ? '••••••••' : 'clave secreta'} />
            </div>
          </div>
          <button type="button" className="btn btn-secundario" onClick={() => probarPasarela('mercadopago')} style={{ marginBottom: 8 }}>
            Probar credenciales de Mercado Pago
          </button>

          <h3 style={{ fontSize: 14, marginTop: 8 }}>PayPal</h3>
          <label className="check-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" name="paypal_activo" defaultChecked={configPagos?.paypal_activo !== false} />
            Habilitar PayPal como medio de pago
          </label>
          {configPagos?.paypal_activo !== false && !configPagos?.tiene_paypal && (
            <p className="ayuda" style={{ color: '#b45309', marginBottom: 8 }}>
              Habilitado, pero sin Client ID/Secret: no se mostrara a los usuarios hasta guardarlos.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div className="campo">
              <label>Client ID {configPagos?.tiene_paypal ? '(configurado)' : ''}</label>
              <input name="paypal_client_id" type="password" placeholder={configPagos?.tiene_paypal ? '••••••••' : 'client id'} />
            </div>
            <div className="campo">
              <label>Secret {configPagos?.tiene_paypal ? '(configurado)' : ''}</label>
              <input name="paypal_secret" type="password" placeholder={configPagos?.tiene_paypal ? '••••••••' : 'secret'} />
            </div>
            <div className="campo">
              <label>Webhook ID {configPagos?.tiene_paypal_webhook ? '(configurado)' : ''}</label>
              <input name="paypal_webhook_id" type="password" placeholder={configPagos?.tiene_paypal_webhook ? '••••••••' : 'webhook id'} />
            </div>
            <div className="campo">
              <label>Modo</label>
              <select name="paypal_mode" defaultValue={configPagos?.paypal_mode || 'sandbox'}>
                <option value="sandbox">Sandbox (pruebas)</option>
                <option value="live">Live (produccion)</option>
              </select>
            </div>
          </div>
          <button type="button" className="btn btn-secundario" onClick={() => probarPasarela('paypal')} style={{ marginBottom: 8 }}>
            Probar credenciales de PayPal
          </button>

          <h3 style={{ fontSize: 14, marginTop: 8 }}>Transferencia bancaria</h3>
          <label className="check-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" name="transferencia_activa" defaultChecked={configPagos?.transferencia_activa !== false} />
            Habilitar transferencia bancaria como medio de pago
          </label>
          {configPagos?.transferencia_activa !== false && !configPagos?.transferencia_banco && !configPagos?.transferencia_cuenta && (
            <p className="ayuda" style={{ color: '#b45309', marginBottom: 8 }}>
              Habilitada, pero sin banco/cuenta: no se mostrara a los usuarios hasta completar los datos.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div className="campo">
              <label>Banco</label>
              <input name="transferencia_banco" defaultValue={configPagos?.transferencia_banco || ''} placeholder="Banco" />
            </div>
            <div className="campo">
              <label>Cuenta</label>
              <input name="transferencia_cuenta" defaultValue={configPagos?.transferencia_cuenta || ''} placeholder="0000-0000-00-0000000000" />
            </div>
            <div className="campo">
              <label>Titular</label>
              <input name="transferencia_titular" defaultValue={configPagos?.transferencia_titular || ''} placeholder="Nombre del titular" />
            </div>
            <div className="campo">
              <label>RIF / identificador</label>
              <input name="transferencia_rif" defaultValue={configPagos?.transferencia_rif || ''} placeholder="J-12345678-9" />
            </div>
          </div>
          <div className="campo">
            <label>URL del QR / imagen (opcional)</label>
            <input name="transferencia_qr_url" defaultValue={configPagos?.transferencia_qr_url || ''} placeholder="https://.../qr.png" />
          </div>
          <div className="campo">
            <label>Instrucciones</label>
            <textarea name="transferencia_instrucciones" rows="3" defaultValue={configPagos?.transferencia_instrucciones || ''} placeholder="Instrucciones para el usuario al transferir..." />
          </div>

          <button type="submit" className="btn">Guardar configuracion de pagos</button>
        </form>
      </section>

      <section className="panel-admin sec-paginas">
        <h2>Paginas publicas (landing y blog)</h2>
        <p className="ayuda">
          Crea paginas de aterrizaje y blog editables en HTML puro. Usa el marcador{' '}
          <code>{'{{REGISTRO}}'}</code> para insertar el formulario de registro.
          Las paginas publicadas quedan disponibles en <code>/p/{'{slug}'}</code>.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secundario" onClick={cargarPaginas}>
            {paginasCargando ? 'Cargando...' : 'Actualizar'}
          </button>
          <button className="btn btn-primary" onClick={abrirNuevaPagina}>
            + Nueva pagina
          </button>
        </div>
        <table className="tabla-admin">
          <thead>
            <tr><th>Titulo</th><th>Slug</th><th>Tipo</th><th>Estado</th><th>Actualizada</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {paginas.map((p) => (
              <tr key={p.id}>
                <td>{p.titulo}</td>
                <td className="mono" style={{ fontSize: 12 }}>{p.slug}</td>
                <td>{p.tipo}</td>
                <td>{p.publicado ? 'Publicada' : 'Borrador'}</td>
                <td style={{ fontSize: 12 }}>{p.updated_at ? new Date(p.updated_at).toLocaleString('es-VE') : '-'}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn-mini" onClick={() => abrirEditarPagina(p)}>Editar</button>
                  {p.publicado && (
                    <a className="btn-mini" href={'/p/' + p.slug} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>
                      Ver
                    </a>
                  )}
                  <button className="btn-mini" onClick={() => eliminarPagina(p.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {paginas.length === 0 && !paginasCargando && (
              <tr><td colSpan={6} className="vacio">Sin paginas. Crea la primera.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel-admin sec-marketing">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>Marketing y conversion</h2>
            <p className="ayuda">Campanas, trafico, correo, bajas y usuarios freemium.</p>
          </div>
          <button className="btn btn-secundario" onClick={() => { cargarMarketing(); }}>
            {marketingCargando ? 'Cargando...' : 'Actualizar datos'}
          </button>
        </div>

        <nav className="admin-subtabs">
          {[
            ['resumen', 'Resumen'],
            ['pixeles', 'Pixeles'],
            ['freemium', 'Freemium'],
          ].map(([id, nombre]) => (
            <button
              key={id}
              className={'admin-subtab' + (marketingTab === id ? ' activo' : '')}
              onClick={() => setMarketingTab(id)}
            >
              {nombre}
            </button>
          ))}
        </nav>

        {/* ---------- RESUMEN ---------- */}
        {marketingTab === 'resumen' && (
          <>
            {marketing ? (
              <>
                <h3 style={{ fontSize: 14, marginTop: 4 }}>Usuarios y conversion</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 8 }}>
                  <div className="adopcion-card"><h4>Total empresas</h4><div className="valor">{marketing.resumen.total_empresas}</div></div>
                  <div className="adopcion-card"><h4>Freemium</h4><div className="valor">{marketing.resumen.freemium}</div></div>
                  <div className="adopcion-card"><h4>Pagadas</h4><div className="valor">{marketing.resumen.pagadas}</div></div>
                  <div className="adopcion-card"><h4>Score promedio</h4><div className="valor">{marketing.resumen.score_promedio}</div></div>
                  <div className="adopcion-card"><h4>Alta probabilidad</h4><div className="valor">{marketing.resumen.alta_probabilidad}</div></div>
                </div>
                <p className="ayuda">
                  El rastreo de campanas y el trafico se llevan ahora con herramientas externas (Google Analytics, Tag Manager, etc.).
                  Configura los pixeles en la sub-pestaña "Pixeles".
                </p>
              </>
            ) : (
              <p className="ayuda">Cargando analisis de marketing...</p>
            )}
          </>
        )}

        {/* ---------- CAMPANAS ---------- */}
        {/* ---------- PIXELES ---------- */}
        {marketingTab === 'pixeles' && (
          <>
            <h3 style={{ fontSize: 15, marginTop: 4 }}>Pixeles y codigo de seguimiento</h3>
            <p className="ayuda">
              Configura Google Analytics 4, Google Tag Manager y codigo adicional para pixeles
              (Meta, TikTok, LinkedIn, etc.). Los IDs generan el codigo estandar automaticamente.
            </p>

            {pixelesMensaje && <div className="mensaje ok" style={{ marginBottom: 10 }}>{pixelesMensaje}</div>}
            {pixelesCargando && <p className="ayuda">Cargando...</p>}

            {pixelesConfig && (
              <form onSubmit={guardarPixeles}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div className="campo">
                    <label>Google Analytics 4 (Measurement ID)</label>
                    <input name="ga_measurement_id" defaultValue={pixelesConfig.ga_measurement_id || ''} placeholder="G-XXXXXXXXXX" />
                  </div>
                  <div className="campo">
                    <label>Google Tag Manager (Container ID)</label>
                    <input name="gtm_id" defaultValue={pixelesConfig.gtm_id || ''} placeholder="GTM-XXXXXXX" />
                  </div>
                </div>

                <div className="campo">
                  <label>Codigo en &lt;head&gt; (JavaScript)</label>
                  <textarea name="head_code" rows={4} defaultValue={pixelesConfig.head_code || ''} placeholder="window.dataLayer = window.dataLayer || [];" style={{ fontFamily: 'Consolas, monospace', fontSize: 12.5 }} />
                  <div className="ayuda">Se inserta al final del &lt;head&gt;. Pega el JavaScript sin las etiquetas &lt;script&gt; (si las incluyes, se extraen automaticamente).</div>
                </div>

                <div className="campo">
                  <label>Codigo despues de abrir &lt;body&gt; (JavaScript)</label>
                  <textarea name="body_open_code" rows={4} defaultValue={pixelesConfig.body_open_code || ''} placeholder="// Pixel o inicializacion" style={{ fontFamily: 'Consolas, monospace', fontSize: 12.5 }} />
                </div>

                <div className="campo">
                  <label>Codigo antes de cerrar &lt;/body&gt; (JavaScript)</label>
                  <textarea name="body_close_code" rows={4} defaultValue={pixelesConfig.body_close_code || ''} placeholder="// Eventos finales" style={{ fontFamily: 'Consolas, monospace', fontSize: 12.5 }} />
                </div>

                <button type="submit" className="btn">Guardar pixeles</button>
              </form>
            )}

            <p className="ayuda" style={{ marginTop: 12 }}>
              Los cambios se aplican en la siguiente carga del sitio. Si pegas un snippet completo
              con etiquetas &lt;script&gt;, el sistema conserva solo el JavaScript interior.
            </p>
          </>
        )}

        {/* ---------- FREEMIUM ---------- */}
        {marketingTab === 'freemium' && (
          <>
            {marketing ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div className="adopcion-card"><h4>Total empresas</h4><div className="valor">{marketing.resumen.total_empresas}</div></div>
                  <div className="adopcion-card"><h4>Freemium</h4><div className="valor">{marketing.resumen.freemium}</div></div>
                  <div className="adopcion-card"><h4>Pagadas</h4><div className="valor">{marketing.resumen.pagadas}</div></div>
                  <div className="adopcion-card"><h4>Score promedio</h4><div className="valor">{marketing.resumen.score_promedio}</div></div>
                  <div className="adopcion-card"><h4>Alta probabilidad</h4><div className="valor">{marketing.resumen.alta_probabilidad}</div></div>
                </div>

                <h3 style={{ fontSize: 14, marginTop: 4 }}>Usuarios freemium (por probabilidad de conversion)</h3>
                <table className="tabla-admin">
                  <thead>
                    <tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Productos</th><th>Usuarios</th><th>Movs</th><th>Ventas</th><th>Dias</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {freemiumPag.filas.map((u) => (
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
                    {freemiumPag.total === 0 && <tr><td colSpan={9} className="vacio">Sin usuarios freemium</td></tr>}
                  </tbody>
                </table>
                <Paginacion total={freemiumPag.total} pagina={freemiumPag.pagina} setPagina={setPagFreemium} />
              </>
            ) : (
              <p className="ayuda">Cargando analisis de freemium...</p>
            )}
          </>
        )}
      </section>

      <section className="panel-admin sec-soporte">
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
      {paginaModal && paginaEditando && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            padding: 20, overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 1280,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {paginaEditando.id ? 'Editar pagina' : 'Nueva pagina'}
              </h2>
              <button className="btn btn-secundario" onClick={() => { setPaginaModal(false); setPaginaEditando(null); }}>
                Cerrar
              </button>
            </div>

            <form onSubmit={guardarPagina}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div className="campo">
                  <label>Titulo</label>
                  <input
                    value={paginaEditando.titulo}
                    onChange={(e) => setPaginaEditando({ ...paginaEditando, titulo: e.target.value })}
                    required
                  />
                </div>
                <div className="campo">
                  <label>Slug (URL)</label>
                  <input
                    value={paginaEditando.slug}
                    onChange={(e) => setPaginaEditando({ ...paginaEditando, slug: e.target.value })}
                    placeholder="se-genera-del-titulo"
                  />
                </div>
                <div className="campo">
                  <label>Tipo</label>
                  <select
                    value={paginaEditando.tipo}
                    onChange={(e) => setPaginaEditando({ ...paginaEditando, tipo: e.target.value })}
                  >
                    <option value="landing">Landing</option>
                    <option value="blog">Blog</option>
                  </select>
                </div>
                <div className="campo" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={paginaEditando.publicado}
                      onChange={(e) => setPaginaEditando({ ...paginaEditando, publicado: e.target.checked })}
                    />
                    Publicada
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    HTML (puro)
                  </label>
                  <textarea
                    value={paginaEditando.html}
                    onChange={(e) => setPaginaEditando({ ...paginaEditando, html: e.target.value })}
                    rows={22}
                    style={{
                      width: '100%', fontFamily: 'Consolas, monospace', fontSize: 12.5,
                      border: '1px solid #e2e8f0', borderRadius: 8, padding: 10,
                      resize: 'vertical', minHeight: 360,
                    }}
                    placeholder="<div>...</div>"
                  />
                  <p className="ayuda" style={{ marginTop: 6 }}>
                    Usa <code>{'{{REGISTRO}}'}</code> para insertar el formulario de registro.
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Vista previa
                  </label>
                  <iframe
                    title="Vista previa"
                    srcDoc={(paginaEditando.html || '').replace(/\{\{REGISTRO\}\}/g, '<div style="padding:20px;text-align:center;background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:8px;color:#64748b;font-family:sans-serif;">[ Formulario de registro ]</div>')}
                    sandbox="allow-scripts allow-same-origin"
                    style={{ width: '100%', height: 420, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secundario" onClick={() => { setPaginaModal(false); setPaginaEditando(null); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar pagina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}

const POR_PAGINA = 15;

function paginar(lista, pagina) {
  const total = (lista || []).length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const p = Math.min(Math.max(1, pagina), paginas);
  return {
    filas: (lista || []).slice((p - 1) * POR_PAGINA, p * POR_PAGINA),
    total,
    paginas,
    pagina: p,
  };
}

function Paginacion({ total, pagina, setPagina }) {
  const paginas = Math.max(1, Math.ceil((total || 0) / POR_PAGINA));
  if (paginas <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0', flexWrap: 'wrap' }}>
      <button className="btn-mini" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
      <span className="ayuda">Pagina {pagina} de {paginas} · {total} registros</span>
      <button className="btn-mini" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
    </div>
  );
}

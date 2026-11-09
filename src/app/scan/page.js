'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';
import Footer from '@/components/Footer';
import ScanModal, { MODOS_SCAN } from '@/components/ScanModal';
import { asegurarSesion, leerSesion, fetchConSesion } from '@/lib/sesionCliente';

export default function ScanPage() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('consultar');
  const [savedMsg, setSavedMsg] = useState('');
  const [sessionStatus, setSessionStatus] = useState('cargando'); // cargando | super | no-super | sin-sesion
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [formNuevo, setFormNuevo] = useState({ nombre: '', precio_venta: '', unidad: 'unidad' });

  useEffect(() => {
    (async () => {
      await asegurarSesion();
      const s = leerSesion();
      const token = s && s.access_token;
      if (!token) { setSessionStatus('sin-sesion'); return; }
      try {
        const r = await fetchConSesion('/api/auth/sesion', { cache: 'no-store' });
        if (!r.ok) { setSessionStatus('sin-sesion'); return; }
        const j = await r.json();
        const u = j.usuario;
        setUsuarioNombre(u.nombre || u.usuario || '');
        if (u.super_admin) {
          setSessionStatus('super');
          setOpen(true);
        } else {
          setSessionStatus('no-super');
        }
      } catch { setSessionStatus('sin-sesion'); }
    })();
  }, []);

  async function handleResult(code, scannedMode) {
    setMode(scannedMode);
    setLookup(null);
    setLookupError('');
    setLookupLoading(true);
    try {
      const r = await fetchConSesion(`/api/scan/lookup?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Error consultando');
      setLookup(j);
      if (!j.encontrado) {
        setFormNuevo({ nombre: '', precio_venta: '', unidad: 'unidad' });
      }
    } catch (e) {
      setLookupError(e.message || String(e));
    } finally { setLookupLoading(false); }
  }

  async function handleSave(code, type, confirmCb) {
    try {
      const r = await fetchConSesion('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_type: type, code, nombre: '' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok && j.error) throw new Error(j.error);
      setSavedMsg(`✅ Guardado como ${type === 'producto' ? 'producto' : type === 'proveedor' ? 'proveedor' : 'almacén'} (código: ${code})`);
      confirmCb();
    } catch (e) {
      alert('Error guardando: ' + (e && e.message ? e.message : e));
      confirmCb();
    }
  }

  async function crearProductoNuevo() {
    if (!lookup || lookup.encontrado) return;
    if (!formNuevo.nombre.trim()) { alert('El nombre es obligatorio'); return; }
    const code = lookup.code || '';
    try {
      const r = await fetchConSesion('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_type: 'producto',
          code,
          nombre: formNuevo.nombre.trim(),
          precio_venta: Number(formNuevo.precio_venta) || 0,
          unidad: formNuevo.unidad || 'unidad',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Error creando producto');
      setSavedMsg(`✅ Producto creado: ${formNuevo.nombre} (código: ${code})`);
      setOpen(false);
      // re-consultar
      await handleResult(code, mode);
    } catch (e) { alert(e.message || e); }
  }

  function irAVenta() {
    if (!lookup || !lookup.encontrado) return;
    const codigo = lookup.producto.codigo || lookup.code;
    const id = lookup.producto.id;
    // Guardar para el POS del panel (renderer legacy)
    try { localStorage.setItem('inventser_venta_codigo', codigo); localStorage.setItem('inventser_venta_id', String(id)); } catch {}
    window.location.href = `/panel?venta_codigo=${encodeURIComponent(codigo)}`;
  }

  const modoInfo = MODOS_SCAN.find((m) => m.id === mode) || MODOS_SCAN[0];

  return (
    <>
      <header className="landing-header">
        <Link href="/" className="landing-marca" aria-label="inventserOnline">
          <img src="/logo.png" alt="inventserOnline" className="landing-logo" width="96" height="52" />
          <span className="landing-tagline">Sistema de Inventarios</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
          {sessionStatus === 'super' && <Link className="btn" href="/panel">Ir al panel</Link>}
          <GoogleTranslate />
        </nav>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '70vh', padding: '20px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Digitaliza tu código</h1>

        {sessionStatus === 'cargando' && <p style={{ color: '#555' }}>Verificando tu sesión…</p>}

        {sessionStatus === 'sin-sesion' && (
          <>
            <p style={{ color: '#555', maxWidth: 480, fontSize: 16, lineHeight: 1.6, textAlign: 'center' }}>
              El escáner está disponible solo para el <strong>administrador general</strong> por ahora. Inicia sesión para continuar.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link className="btn" href="/entrar">Iniciar sesión</Link>
              <Link className="btn btn-secundario" href="/registro">Registrar cuenta</Link>
            </div>
          </>
        )}

        {sessionStatus === 'no-super' && (
          <>
            <p style={{ color: '#555', maxWidth: 480, fontSize: 16, lineHeight: 1.6, textAlign: 'center' }}>
              Hola {usuarioNombre && <strong>{usuarioNombre}</strong>}. El escáner está disponible solo para el <strong>administrador general</strong> por ahora. Se liberará para todos los usuarios cuando esté verificado.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link className="btn" href="/panel">Volver al panel</Link>
            </div>
          </>
        )}

        {sessionStatus === 'super' && (
          <>
            <p style={{ color: '#555', fontSize: 15, lineHeight: 1.6, textAlign: 'center' }}>
              Escanea un código QR o de barras. Elegí antes qué querés hacer.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
              {MODOS_SCAN.map((m) => (
                <button key={m.id} onClick={() => { setMode(m.id); }}
                  style={{
                    padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    border: mode === m.id ? '2px solid #0077b5' : '1px solid #ddd',
                    background: mode === m.id ? '#e6f2fb' : '#fff',
                    fontWeight: mode === m.id ? 700 : 400,
                  }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{modoInfo.desc}</p>

            {savedMsg && <div style={{ background: '#d4edda', color: '#155724', padding: '10px 16px', borderRadius: 8, marginTop: 14, fontSize: 14, width: '100%' }}>{savedMsg}</div>}

            <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn" onClick={() => setOpen(true)}>📷 Escanear ahora ({modoInfo.label})</button>
              <Link className="btn btn-secundario" href="/panel">Ir al panel</Link>
            </div>

            {/* Resultado del lookup */}
            {lookupLoading && <p style={{ marginTop: 20, color: '#666' }}>Buscando producto…</p>}
            {lookupError && <p style={{ marginTop: 16, color: '#c33' }}>{lookupError}</p>}

            {lookup && !lookupLoading && (
              <div style={{ width: '100%', marginTop: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, textAlign: 'left' }}>
                <p className="mono" style={{ fontSize: 12, color: '#555', margin: '0 0 8px' }}>Código: {lookup.code || lookup.producto?.codigo || '-'}</p>

                {!lookup.encontrado && (
                  <>
                    <h3 style={{ margin: '0 0 8px', color: '#b45309' }}>⚠️ Producto no encontrado</h3>
                    <p style={{ fontSize: 13, color: '#666' }}>Este código aún no está registrado en tu inventario. Podés crearlo ahora.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      <label style={{ fontSize: 13 }}>Nombre *<input value={formNuevo.nombre} onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })} placeholder="Nombre del producto" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, marginTop: 4 }} /></label>
                      <label style={{ fontSize: 13 }}>Precio venta<input type="number" step="0.01" value={formNuevo.precio_venta} onChange={(e) => setFormNuevo({ ...formNuevo, precio_venta: e.target.value })} placeholder="0.00" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, marginTop: 4 }} /></label>
                      <label style={{ fontSize: 13 }}>Unidad<input value={formNuevo.unidad} onChange={(e) => setFormNuevo({ ...formNuevo, unidad: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, marginTop: 4 }} /></label>
                      <button className="btn" onClick={crearProductoNuevo} style={{ marginTop: 6 }}>➕ Crear producto</button>
                    </div>
                  </>
                )}

                {lookup.encontrado && lookup.producto && (
                  <>
                    <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{lookup.producto.nombre}</h3>
                    <p style={{ fontSize: 13, color: '#555', margin: '0 0 10px' }} className="mono">SKU: {lookup.producto.codigo || '-'} · ID: {lookup.producto.id}</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                      <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}><strong>{lookup.producto.stock_actual}</strong><div style={{ fontSize: 11, color: '#666' }}>Stock</div></div>
                      <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}><strong>${Number(lookup.producto.precio_venta || 0).toFixed(2)}</strong><div style={{ fontSize: 11, color: '#666' }}>Precio venta</div></div>
                      <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}><strong>{lookup.producto.unidad || 'unidad'}</strong><div style={{ fontSize: 11, color: '#666' }}>Unidad</div></div>
                    </div>

                    {lookup.stock_por_almacen?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <strong style={{ fontSize: 13 }}>Stock por almacén</strong>
                        <ul style={{ fontSize: 13, paddingLeft: 18, margin: '4px 0 0' }}>
                          {lookup.stock_por_almacen.map((s, i) => <li key={i}>{s.almacen}: {s.cantidad}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Acciones según modo */}
                    {mode === 'consultar' && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link className="btn btn-secundario" href={`/panel?producto=${lookup.producto.id}`}>Ver ficha completa</Link>
                        <button className="btn" onClick={() => setOpen(true)}>🔄 Escanear otro</button>
                      </div>
                    )}

                    {mode === 'venta' && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn" onClick={irAVenta}>🛒 Agregar a venta</button>
                        <button className="btn btn-secundario" onClick={() => setOpen(true)}>Escanear otro</button>
                      </div>
                    )}

                    {mode === 'trazabilidad' && (
                      <>
                        {lookup.ultimos_movimientos?.length > 0 ? (
                          <table className="tabla" style={{ width: '100%', fontSize: 12 }}>
                            <thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Usuario</th><th>Obs.</th></tr></thead>
                            <tbody>
                              {lookup.ultimos_movimientos.map((m, i) => (
                                <tr key={i}>
                                  <td>{m.fecha ? new Date(m.fecha).toLocaleDateString('es-VE') : '-'}</td>
                                  <td>{m.tipo}</td><td>{m.cantidad}</td><td>{m.usuario || '-'}</td><td>{m.observacion || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : <p style={{ fontSize: 13, color: '#666' }}>Sin movimientos registrados.</p>}
                        <div style={{ marginTop: 10 }}>
                          <Link className="btn btn-secundario" href={`/panel?producto=${lookup.producto.id}`}>Ver Kardex completo</Link>
                        </div>
                      </>
                    )}

                    {mode === 'nuevo' && (
                      <p style={{ fontSize: 13, color: '#0a7a33' }}>✅ Este código ya existe. Si querías crearlo, ya está registrado.</p>
                    )}
                  </>
                )}
              </div>
            )}

            <div style={{ marginTop: 24, color: '#888', fontSize: 12, textAlign: 'center' }}>
              📱 En móvil usa cámara trasera. Subir foto también funciona.
            </div>
          </>
        )}
      </main>

      <Footer />
      <ScanModal open={open} onClose={() => setOpen(false)} mode={mode} onModeChange={setMode} onResult={handleResult} />
    </>
  );
}

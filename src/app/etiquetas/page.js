'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';
import { asegurarSesion, leerSesion, fetchConSesion } from '@/lib/sesionCliente';

export const PLANTILLAS = {
  XS: { id: 'XS', label: 'XS 30×15mm (píldoras)', w: 30, h: 15, barcodeH: 12, font: 7, qr: 12, cols: 3 },
  S:  { id: 'S', label: 'S 40×20mm (pequeño)', w: 40, h: 20, barcodeH: 16, font: 8, qr: 16, cols: 3 },
  M:  { id: 'M', label: 'M 50×25mm (normal)', w: 50, h: 25, barcodeH: 22, font: 9, qr: 20, cols: 2 },
  L:  { id: 'L', label: 'L 60×40mm (grande)', w: 60, h: 40, barcodeH: 30, font: 10, qr: 28, cols: 1 },
};

export default function EtiquetasPage() {
  const [sessionStatus, setSessionStatus] = useState('cargando');
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [buscador, setBuscador] = useState('');
  const [seleccion, setSeleccion] = useState({});
  const [tplId, setTplId] = useState('M');
  const [tipo, setTipo] = useState('ambas'); // barra | qr | ambas
  const [mostrar, setMostrar] = useState({ nombre: true, precio: true, id: true, sku: true });
  const loadedScriptRef = useRef({});

  useEffect(() => {
    (async () => {
      await asegurarSesion();
      const s = leerSesion();
      if (!s || !s.access_token) { setSessionStatus('sin-sesion'); return; }
      try {
        const r = await fetchConSesion('/api/auth/sesion', { cache: 'no-store' });
        if (!r.ok) { setSessionStatus('sin-sesion'); return; }
        const j = await r.json(); const u = j.usuario; setUsuarioNombre(u.nombre || u.usuario || '');
        if (!u.super_admin) { setSessionStatus('no-super'); return; } setSessionStatus('super'); await cargarProductos();
      } catch { setSessionStatus('sin-sesion'); }
    })();
  }, []);

  async function cargarProductos() {
    setCargando(true);
    try { const r = await fetchConSesion('/api/productos?limite=500'); const j = await r.json(); if (r.ok) setProductos(j.productos || []); }
    finally { setCargando(false); }
  }

  useEffect(() => {
    loadScript('jsbarcode', 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js');
    loadScript('qrcode', 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js');
  }, []);

  function loadScript(name, src) {
    if (loadedScriptRef.current[name]) return;
    const s = document.createElement('script');
    s.src = src; s.onload = () => { loadedScriptRef.current[name] = true; };
    document.head.appendChild(s);
  }

  const productosFiltrados = productos.filter((p) => {
    if (!buscador.trim()) return true;
    const t = buscador.toLowerCase();
    return String(p.nombre || '').toLowerCase().includes(t) || String(p.codigo || '').toLowerCase().includes(t);
  });
  const seleccionados = productosFiltrados.filter((p) => seleccion[p.id]);
  const tpl = PLANTILLAS[tplId];

  function imprimir() { window.print(); }

  if (sessionStatus === 'cargando') return <div style={{ padding: 40, textAlign: 'center' }}>Verificando sesión…</div>;
  if (sessionStatus !== 'super') {
    return <main style={{ padding: 40, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}><h1>Etiquetas — acceso restringido</h1>
      <p>{sessionStatus === 'sin-sesion' ? 'Inicia sesión' : `Hola ${usuarioNombre}. Solo administrador general`}.</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}><Link className="btn" href="/entrar">Iniciar sesión</Link><Link className="btn btn-secundario" href="/panel">Volver</Link></div></main>;
  }

  return (
    <>
      <header className="landing-header">
        <Link href="/" className="landing-marca"><img src="/logo.png" alt="inventserOnline" className="landing-logo" width="96" height="52" /><span className="landing-tagline">Sistema de Inventarios</span></Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Link className="btn" href="/panel">Panel</Link><GoogleTranslate /></nav>
      </header>

      <main className="seo-seccion" style={{ maxWidth: 720, margin: '32px auto 48px' }}>
        <h1>Generador de etiquetas</h1>
        <p>Imprime etiquetas con código de barras y/o QR. El QR lleva datos completos para escaneo offline.</p>

        {/* Configuración */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, margin: '16px 0' }}>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10 }}>
            <strong>Plantilla • tamaño</strong>
            <select value={tplId} onChange={(e) => setTplId(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 6 }}>
              {Object.values(PLANTILLAS).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10 }}>
            <strong>Tipo de código</strong>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 6 }}>
              <option value="ambas">Barra + QR (completo)</option>
              <option value="barra">Solo código de barras</option>
              <option value="qr">Solo QR</option>
            </select>
          </div>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10 }}>
            <strong>Texto debajo</strong>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              {['nombre', 'precio', 'id', 'sku'].map((k) => (
                <label key={k} style={{ display: 'block', marginBottom: 4 }}>
                  <input type="checkbox" checked={mostrar[k]} onChange={(e) => setMostrar({...mostrar, [k]: e.target.checked})} /> {k === 'id' ? 'ID' : k === 'sku' ? 'SKU' : k[0].toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Selección */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input placeholder="Buscar producto…" value={buscador} onChange={(e) => setBuscador(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          <button className="btn btn-secundario" onClick={cargarProductos}>{cargando ? 'Cargando…' : 'Recargar'}</button>
          <button className="btn btn-secundario" onClick={() => { const o = {}; productosFiltrados.forEach((p) => (o[p.id] = true)); setSeleccion(o); }}>Seleccionar todos</button>
          <button className="btn btn-secundario" onClick={() => setSeleccion({})}>Limpiar</button>
          <button className="btn" onClick={imprimir} disabled={seleccionados.length === 0}>🖨 Imprimir</button>
        </div>

        {/* Lista de productos */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, overflowX: 'auto', marginBottom: 14 }}>
          {productosFiltrados.slice(0, 100).map((p) => (
            <label key={p.id} style={{ border: '1px solid #e5e7eb', padding: 10, borderRadius: 8, minWidth: 150, cursor: 'pointer', background: seleccion[p.id] ? '#e6f2fb' : '#fff' }}>
              <input type="checkbox" checked={!!seleccion[p.id]} onChange={(e) => setSeleccion({...seleccion, [p.id]: e.target.checked})} /> <strong style={{ fontSize: 13 }}>{p.nombre}</strong>
              <div style={{ fontSize: 11, color: '#666' }} className="mono">{p.codigo} · ${Number(p.precio_venta || 0).toFixed(2)}</div>
            </label>
          ))}
        </div>

        {/* Etiquetas imprimibles */}
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>Vista previa ({seleccionados.length} etiquetas)</h3>
          <div className="labels-sheet" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: 'fit-content' }}>
            {seleccionados.map((p) => (
              <Etiqueta key={p.id} p={p} tpl={tpl} tipo={tipo} mostrar={mostrar} />
            ))}
            {seleccionados.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Selecciona productos para previsualizar.</p>}
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, padding: '24px 16px 16px', fontSize: 13, color: '#666' }}>
          <div><strong>inventserOnline</strong><p>Sistema de Inventarios Online · Funciona en la nube</p><p>© {new Date().getFullYear()}. Todos los derechos reservados.</p></div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/precios">Precios</Link><Link href="/terminos">Términos</Link><Link href="/privacidad">Privacidad</Link><Link href="/mapa-del-sitio">Mapa</Link>
          </div>
          <div><strong>Contacto</strong><a href="https://wa.me/522227328662" style={{ display: 'block', marginTop: 4 }}>📱 WhatsApp: 2227328662</a><a href="mailto:contacto@inventser.online" style={{ display: 'block', marginTop: 4 }}>✉️ contacto@inventser.online</a></div>
        </div>
      </footer>

      <style>{`
        @media print {
          .landing-header, header, footer, nav, .btn { display: none !important; }
          main { padding: 0 !important; }
          body { margin: 0; }
        }
        .no-print { display: block !important; }
      `}</style>
    </>
  );
}

function Etiqueta({ p, tpl, tipo, mostrar }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      if (cancelled) return;
      try {
        // Barra de códigos
        if ((tipo === 'barra' || tipo === 'ambas') && window.JsBarcode && svgRef.current) {
          const format = /^\d{13}$/.test(String(p.codigo || '')) ? 'EAN13' : 'CODE128';
          window.JsBarcode(svgRef.current, String(p.codigo || ''), {
            format, width: Math.max(1, Math.min(3, Math.floor(tpl.w / 20))),
            height: tpl.barcodeH, displayValue: false, margin: 2, lineColor: '#000',
          });
        }
        // QR
        if ((tipo === 'qr' || tipo === 'ambas') && window.QRCode) {
          const QRCode = window.QRCode;
          const payload = JSON.stringify({ t: 'inv', id: p.id, code: String(p.codigo || ''), price: Number(p.precio_venta || 0) });
          if (typeof QRCode.toCanvas === 'function') {
            await QRCode.toCanvas(canvasRef.current, payload, { width: tpl.qr * 6, margin: 1 });
          } else if (typeof QRCode.toDataURL === 'function') {
            const url = await QRCode.toDataURL(payload, { width: tpl.qr * 6 });
            if (canvasRef.current) { canvasRef.current.src = url; canvasRef.current.width = tpl.qr * 6; canvasRef.current.height = tpl.qr * 6; }
          }
        }
        if (!cancelled) setReady(true);
      } catch (e) { console.error('Error generando etiqueta:', e); }
    }
    generate();
    return () => { cancelled = true; };
  }, [p.id, tipo, tpl]);

  const showBarra = tipo === 'ambas' || tipo === 'barra';
  const showQR = tipo === 'ambas' || tipo === 'qr';
  const flexDir = tipo === 'ambas' ? 'row' : 'column';

  return (
    <div style={{
      width: `${tpl.w}mm`, height: `${tpl.h}mm`, border: '1px dashed #cbd5e1',
      padding: tpl.pad, boxSizing: 'border-box', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#fff', fontFamily: 'Consolas, monospace', fontSize: `${tpl.font}px`,
      overflow: 'hidden', pageBreakInside: 'avoid',
    }}>
      <div style={{ display: 'flex', flexDirection: flexDir, gap: 4, alignItems: 'center', justifyContent: 'center' }}>
        {showBarra && <svg ref={svgRef} style={{ width: '100%', maxHeight: `${tpl.barcodeH}mm`, display: 'block' }} />}
        {showQR && <canvas ref={canvasRef} style={{ width: `${tpl.qr}px`, height: `${tpl.qr}px` }} />}
      </div>
      <div style={{ textAlign: 'center', marginTop: 4, wordBreak: 'break-word', color: '#000' }}>
        {mostrar.nombre && <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</strong>}
        <div style={{ marginTop: 2 }}>
          {mostrar.id && <span>Id:{p.id}&nbsp;</span>}
          {mostrar.sku && p.codigo && <span>· {p.codigo}&nbsp;</span>}
          {mostrar.precio && <span>· ${Number(p.precio_venta || 0).toFixed(2)}</span>}
        </div>
      </div>
    </div>
  );
}

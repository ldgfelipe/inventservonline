'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';
import Footer from '@/components/Footer';
import { asegurarSesion, leerSesion, fetchConSesion } from '@/lib/sesionCliente';

/**
 * Plantillas de impresión — 4 tamaños adaptados a productos chicos / grandes.
 * Configurables según impresora del cliente (térmica / A4).
 *
 * XS (30x15mm)  — píldoras, tornillería, micro: barra 12mm, texto 7pt, QR 12mm
 * S  (40x20mm)  — pequeño: barra 16mm, texto 8pt, QR 16mm
 * M  (50x25mm)  — normal: barra 22mm, texto 9pt, QR 20mm (recomendada)
 * L  (60x40mm)  — grande: barra 30mm, texto 10pt, QR 28mm (cajas)
 */
export const PLANTILLAS = {
  XS: { id: 'XS', label: 'XS · Muy pequeño 30x15', w: 30, h: 15, barcodeH: 12, font: 7, qr: 12, pad: 2, cols: 3 },
  S:  { id: 'S', label: 'S · Pequeño 40x20', w: 40, h: 20, barcodeH: 16, font: 8, qr: 16, pad: 3, cols: 3 },
  M:  { id: 'M', label: 'M · Normal 50x25', w: 50, h: 25, barcodeH: 22, font: 9, qr: 20, pad: 3, cols: 2 },
  L:  { id: 'L', label: 'L · Grande 60x40', w: 60, h: 40, barcodeH: 30, font: 10, qr: 28, pad: 4, cols: 1 },
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
  const [qrJson, setQrJson] = useState(true);

  const tpl = PLANTILLAS[tplId];

  useEffect(() => {
    (async () => {
      await asegurarSesion();
      const s = leerSesion();
      if (!s || !s.access_token) { setSessionStatus('sin-sesion'); return; }
      try {
        const r = await fetchConSesion('/api/auth/sesion', { cache: 'no-store' });
        if (!r.ok) { setSessionStatus('sin-sesion'); return; }
        const j = await r.json();
        const u = j.usuario;
        setUsuarioNombre(u.nombre || u.usuario || '');
        if (!u.super_admin) { setSessionStatus('no-super'); return; }
        setSessionStatus('super');
        await cargarProductos();
      } catch { setSessionStatus('sin-sesion'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarProductos() {
    setCargando(true);
    try {
      const r = await fetchConSesion('/api/productos?limite=500', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setProductos(j.productos || []);
    } finally { setCargando(false); }
  }

  const productosFiltrados = productos.filter((p) => {
    if (!buscador.trim()) return true;
    const t = buscador.toLowerCase();
    return String(p.nombre || '').toLowerCase().includes(t) || String(p.codigo || '').toLowerCase().includes(t);
  });

  const seleccionados = productosFiltrados.filter((p) => seleccion[p.id]);

  function payloadQR(p) {
    if (!qrJson) return String(p.codigo || p.id);
    return JSON.stringify({ t: 'inv', id: p.id, code: String(p.codigo || ''), name: String(p.nombre || '').slice(0, 40), price: Number(p.precio_venta) || 0 });
  }

  function codigoBarra(p) {
    const c = String(p.codigo || p.id).replace(/[^\w-]/g, '') || String(p.id);
    // EAN-13 requiere 13 dígitos numéricos; si no cumple, CODE128 (alfanumérico)
    if (/^\d{13}$/.test(c)) return { format: 'EAN13', value: c };
    return { format: 'CODE128', value: c.slice(0, 20) };
  }

  function imprimir() {
    window.print();
  }

  if (sessionStatus === 'cargando') return <div style={{ padding: 40, textAlign: 'center' }}>Verificando sesión…</div>;
  if (sessionStatus !== 'super') {
    return (
      <main style={{ padding: 40, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Etiquetas — acceso restringido</h1>
        <p style={{ color: '#555', marginTop: 12 }}>
          {sessionStatus === 'sin-sesion' ? 'Inicia sesión para usar el generador de etiquetas.' : `Hola ${usuarioNombre}. Por ahora solo el administrador general puede imprimir etiquetas.`}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
          <Link className="btn" href="/entrar">Iniciar sesión</Link>
          <Link className="btn btn-secundario" href="/panel">Volver al panel</Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="landing-header">
        <Link href="/" className="landing-marca"><img src="/logo.png" alt="inventserOnline" className="landing-logo" width="96" height="52" /><span className="landing-tagline">Sistema de Inventarios</span></Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
          <Link className="btn" href="/panel">Ir al panel</Link>
          <GoogleTranslate />
        </nav>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
        <h1 style={{ fontSize: 26, margin: '8px 0 4px' }}>Generador de etiquetas</h1>
        <p style={{ color: '#555', fontSize: 14, marginTop: 0 }}>
          Imprime etiquetas de productos con código de barras y/o QR. El QR puede llevar los datos completos para que la app los procese sin DB (precio, lote, etc.).
        </p>

        {/* Configuración */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginTop: 16 }}>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Plantilla / tamaño</label>
            <select value={tplId} onChange={(e) => setTplId(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 6, borderRadius: 6 }}>
              {Object.values(PLANTILLAS).map((t) => <option key={t.id} value={t.id}>{t.label} · barra {t.barcodeH}mm · texto {t.font}pt</option>)}
            </select>
            <p style={{ fontSize: 12, color: '#666', margin: '8px 0 0' }}>Elige según producto: XS píldoras, S pequeño, M normal, L cajas. Configurable en mm.</p>
          </div>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Tipo de código</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 6, borderRadius: 6 }}>
              <option value="ambas">Ambas (Barra + QR) — recomendado</option>
              <option value="barra">Solo barra (para láser)</option>
              <option value="qr">Solo QR (datos completos)</option>
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={qrJson} onChange={(e) => setQrJson(e.target.checked)} /> QR con JSON completo (id, precio, lote)
            </label>
          </div>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Texto debajo (pequeño, ahorro de tinta)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {(['nombre', 'precio', 'id', 'sku']).map((k) => (
                <label key={k} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={mostrar[k]} onChange={(e) => setMostrar({ ...mostrar, [k]: e.target.checked })} /> {k === 'id' ? 'ID producto' : k === 'sku' ? 'SKU / código' : k[0].toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Selección */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Buscar producto o SKU…" value={buscador} onChange={(e) => setBuscador(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, flex: 1, minWidth: 200 }} />
          <button className="btn btn-secundario" onClick={cargarProductos}>{cargando ? 'Cargando…' : 'Recargar'}</button>
          <button className="btn btn-secundario" onClick={() => { const o = {}; productosFiltrados.forEach((p) => (o[p.id] = true)); setSeleccion(o); }}>Seleccionar todos</button>
          <button className="btn btn-secundario" onClick={() => setSeleccion({})}>Limpiar</button>
          <button className="btn" onClick={imprimir} disabled={seleccionados.length === 0}>🖨 Imprimir ({seleccionados.length}) {tplId} {tpl.w}×{tpl.h}mm</button>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 14, paddingBottom: 8 }}>
          {productosFiltrados.slice(0, 100).map((p) => (
            <label key={p.id} style={{ border: '1px solid #e5e7eb', padding: 10, borderRadius: 8, minWidth: 180, cursor: 'pointer', background: seleccion[p.id] ? '#e6f2fb' : '#fff' }}>
              <input type="checkbox" checked={!!seleccion[p.id]} onChange={(e) => setSeleccion({ ...seleccion, [p.id]: e.target.checked })} /> <strong style={{ fontSize: 13 }}>{p.nombre}</strong>
              <div style={{ fontSize: 11, color: '#666' }} className="mono">{p.codigo || '—'} · ${Number(p.precio_venta || 0).toFixed(2)}</div>
            </label>
          ))}
        </div>

        {/* Vista previa e impresión */}
        <div style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>Vista previa — {seleccionados.length} etiqueta(s) ({tplId} {tpl.w}×{tpl.h}mm)</h3>
          <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 12, overflowX: 'auto' }}>
            <div className="labels-sheet" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: 'fit-content' }}>
              {seleccionados.map((p) => (
                <Etiqueta key={p.id} producto={p} tpl={tpl} tipo={tipo} mostrar={mostrar} payload={payloadQR(p)} codigoBarra={codigoBarra(p)} qrJson={qrJson} />
              ))}
              {seleccionados.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Selecciona productos arriba para previsualizar.</p>}
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>Truco: en el diálogo de impresión elige “Tamaño de papel” según tu impresora térmica o A4 y desactiva encabezados/pies.</p>
        </div>
      </main>
      <Footer />

      <style>{`
        @media print {
          .landing-header, header, footer, .no-print { display: none !important; }
          main { padding: 0 !important; }
          .labels-sheet { background: #fff !important; }
        }
      `}</style>
    </>
  );
}

function Etiqueta({ producto: p, tpl, tipo, mostrar, payload, codigoBarra: cb, qrJson }) {
  const svgRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cargar JsBarcode
      if (tipo !== 'qr' && !window.JsBarcode) {
        await new Promise((res) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
          s.onload = res; s.onerror = res;
          document.head.appendChild(s);
        });
      }
      if (tipo !== 'barra' && !window.QRCode) {
        await new Promise((res) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
          s.onload = res; s.onerror = res;
          document.head.appendChild(s);
        });
      }
      if (cancelled) return;
      try {
        if (svgRef.current && window.JsBarcode) {
          window.JsBarcode(svgRef.current, cb.value, {
            format: cb.format,
            width: Math.max(1, Math.min(3, Math.floor(tpl.w / 20))),
            height: tpl.barcodeH * 2,
            displayValue: false,
            margin: 2,
            lineColor: '#000',
            background: '#fff',
          });
        }
      } catch {}
      try {
        if (qrRef.current && window.QRCode) {
          // QRCode.toCanvas o toDataURL según CDN
          if (typeof window.QRCode.toCanvas === 'function') {
            await window.QRCode.toCanvas(qrRef.current, payload, { width: tpl.qr * 6, margin: 1 });
          } else if (typeof window.QRCode.toDataURL === 'function') {
            const url = await window.QRCode.toDataURL(payload, { width: tpl.qr * 6 });
            if (qrRef.current) qrRef.current.src = url;
          }
        } else if (qrRef.current && qrRef.current.tagName === 'CANVAS' && window.QRCode) {
          window.QRCode.toCanvas(qrRef.current, payload, { width: tpl.qr * 6, margin: 1 });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [p.id, tipo, tpl, payload, cb]);

  const showBarra = tipo === 'ambas' || tipo === 'barra';
  const showQR = tipo === 'ambas' || tipo === 'qr';
  const flexDir = tipo === 'ambas' ? 'row' : 'column';

  return (
    <div style={{
      width: `${tpl.w}mm`, height: `${tpl.h}mm`,
      border: '1px dashed #cbd5e1', padding: tpl.pad, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#fff', fontFamily: 'Consolas, monospace', overflow: 'hidden', pageBreakInside: 'avoid',
    }}>
      <div style={{ display: 'flex', flexDirection: flexDir, gap: 4, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        {showBarra && (
          <svg ref={svgRef} style={{ maxWidth: '100%', maxHeight: `${tpl.barcodeH}mm`, display: 'block' }} />
        )}
        {showQR && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <canvas ref={qrRef} style={{ width: `${tpl.qr}mm`, height: `${tpl.qr}mm`, imageRendering: 'pixelated' }} />
          </div>
        )}
      </div>
      <div style={{ fontSize: `${tpl.font}pt`, textAlign: 'center', lineHeight: 1.1, marginTop: 2, width: '100%', overflow: 'hidden', color: '#000' }}>
        {mostrar.nombre && <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
          {mostrar.id && <span>ID:{p.id}</span>}
          {mostrar.sku && p.codigo && <span>· {p.codigo}</span>}
          {mostrar.precio && <span>· ${Number(p.precio_venta || 0).toFixed(2)}</span>}
        </div>
      </div>
    </div>
  );
}

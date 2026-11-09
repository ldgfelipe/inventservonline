'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * ScanModal — scanner QR / código de barras con 4 modos de acción.
 *
 * Modos:
 *   consultar   -> ver ficha (stock, precios, proveedor)
 *   nuevo       -> registrar como producto nuevo si no existe
 *   venta       -> agregar a carrito / POS
 *   trazabilidad-> ver kardex / últimos movimientos
 *
 * La detección usa 3 motores en orden: BarcodeDetector (Chrome), jsQR (Safari QR),
 * subida de foto como respaldo. La parent maneja el lookup vía /api/scan/lookup.
 */
export const MODOS_SCAN = [
  { id: 'consultar', label: 'Consultar', icon: '🔍', desc: 'Ver ficha del producto' },
  { id: 'nuevo', label: 'Nuevo', icon: '➕', desc: 'Registrar producto nuevo' },
  { id: 'venta', label: 'Venta', icon: '🛒', desc: 'Agregar a venta / POS' },
  { id: 'trazabilidad', label: 'Trazabilidad', icon: '📋', desc: 'Ver kardex e historial' },
];

export default function ScanModal({ open, onClose, mode = 'consultar', onModeChange, onResult, onSave }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const detectorRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [fromPhoto, setFromPhoto] = useState(false);
  const [modoActual, setModoActual] = useState(mode);
  const jsqrReadyRef = useRef(false);
  const scanActiveRef = useRef(false);

  // Sincronizar modo cuando cambia por props
  useEffect(() => { setModoActual(mode); }, [mode]);

  async function loadJsQR() {
    if (jsqrReadyRef.current || (window.jsQR && window.jsQRReady)) return true;
    const existing = document.getElementById('jsqr-cdn');
    if (existing) { jsqrReadyRef.current = true; return true; }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = 'jsqr-cdn';
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.onload = () => { jsqrReadyRef.current = true; resolve(true); };
      s.onerror = () => reject(new Error('No se pudo cargar jsQR'));
      document.head.appendChild(s);
    });
  }

  function stopCamera() {
    scanActiveRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(''); setResult(null); setFromPhoto(false);

    if (!navigator.mediaDevices || !window.isSecureContext) {
      setError('La cámara requiere HTTPS o localhost. Puedes subir una foto del código.');
      return undefined;
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stopCamera(); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if ('BarcodeDetector' in window && !detectorRef.current) {
          try {
            detectorRef.current = new window.BarcodeDetector({
              formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf'],
            });
          } catch { detectorRef.current = null; }
        }
        startScan();
      } catch {
        setError('Cámara no disponible. Revisa el permiso del navegador o sube una foto del código.');
      }
    }

    async function startScan() {
      setScanning(true);
      scanActiveRef.current = true;
      try { await loadJsQR(); } catch { /* sigue sin jsQR */ }

      async function tick() {
        if (!scanActiveRef.current || cancelled) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== 4 || video.videoWidth === 0) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let found = null;
        if (detectorRef.current) {
          try {
            const codes = await detectorRef.current.detect(canvas);
            if (codes && codes.length) found = String(codes[0].rawValue || '').trim();
          } catch { /* ignorar */ }
        }
        if (!found && window.jsQR && canvas.width > 0) {
          try {
            const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(src.data, src.width, src.height, { inversionAttempts: 'dontInvert' });
            if (code && code.data) found = String(code.data).trim();
          } catch { /* ignorar */ }
        }

        if (found) {
          setResult(found);
          setScanning(false);
          stopCamera();
          if (onResult) onResult(found, modoActual);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();
    return () => { cancelled = true; stopCamera(); };
  }, [open]);

  function handleClose() { stopCamera(); setResult(null); setScanning(false); onClose(); }
  function handleModeSelect(id) {
    setModoActual(id);
    if (onModeChange) onModeChange(id);
    // Si ya hay resultado, re-notificar
    if (result && onResult) onResult(result, id);
  }

  function handleSave(type) {
    if (!result || !onSave) return;
    setSaving(true);
    onSave(result, type, () => setSaving(false));
  }

  function pickPhoto() { if (fileRef.current) fileRef.current.click(); }

  async function handlePhotoFile(file) {
    if (!file) return;
    setError(''); setFromPhoto(true);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        let found = null;
        if ('BarcodeDetector' in window) {
          try {
            const codes = await new window.BarcodeDetector({ formats: ['qr_code','ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf'] }).detect(canvas);
            if (codes && codes.length) found = String(codes[0].rawValue || '').trim();
          } catch {}
        }
        if (!found && window.jsQR) {
          try {
            const src = ctx.getImageData(0,0,canvas.width,canvas.height);
            const c = window.jsQR(src.data, src.width, src.height);
            if (c && c.data) found = String(c.data).trim();
          } catch {}
        }
        if (!found) setError('No se encontró código en la foto.');
        else {
          setResult(found); setScanning(false); stopCamera();
          if (onResult) onResult(found, modoActual);
        }
      } catch { setError('No se pudo leer la foto.'); }
    };
    img.onerror = () => { setError('No se pudo cargar la foto.'); URL.revokeObjectURL(url); };
    img.src = url;
  }

  if (!open) return null;

  const modoInfo = MODOS_SCAN.find((m) => m.id === modoActual) || MODOS_SCAN[0];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={handleClose}>
      <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', maxWidth:520, width:'100%', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e)=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', background:'#f4f4f4' }}>
          <span style={{ fontWeight:600, fontSize:15 }}>📷 Escanear · {modoInfo.label}</span>
          <button onClick={handleClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }} aria-label="cerrar">✕</button>
        </div>

        <div style={{ display:'flex', gap:6, padding:'10px 12px', background:'#fafafa', borderBottom:'1px solid #eee', overflowX:'auto' }}>
          {MODOS_SCAN.map((m)=>(
            <button key={m.id} onClick={()=>handleModeSelect(m.id)} title={m.desc} style={{
              flex:1, padding:'8px 6px', borderRadius:8, border: modoActual===m.id?'2px solid #0077b5':'1px solid #ddd',
              background: modoActual===m.id?'#e6f2fb':'#fff', cursor:'pointer', fontSize:13, fontWeight: modoActual===m.id?700:400, whiteSpace:'nowrap'
            }}>{m.icon} {m.label}</button>
          ))}
        </div>

        <div style={{ position:'relative', background:'#000', aspectRatio:'4/3', margin:'12px 16px', overflow:'hidden', borderRadius:8 }}>
          <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} playsInline muted />
          <canvas ref={canvasRef} style={{ display:'none' }} />
          {!result && (
            <div style={{ position:'absolute', top:'50%', left:'50%', width:'70%', height:'60%', transform:'translate(-50%,-50%)', border:'2px solid rgba(255,255,255,0.9)', borderRadius:8, pointerEvents:'none' }}>
              <div style={{ position:'absolute', left:0, right:0, height:2, background:'#00e676', boxShadow:'0 0 8px #00e676', animation:'scanline 1.6s ease-in-out infinite alternate' }} />
            </div>
          )}
          {scanning && <div style={{ position:'absolute', bottom:10, left:0, right:0, textAlign:'center', color:'#fff', fontSize:13 }}>Apunta el código al cuadro · QR o barras</div>}
          {error && <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'rgba(0,0,0,0.8)', color:'#fff', padding:'10px 14px', borderRadius:8, fontSize:13, maxWidth:'85%', textAlign:'center' }}>{error}</div>}
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'center', padding:'0 16px' }}>
          <button className="btn btn-secundario" onClick={pickPhoto} style={{ fontSize:13 }}>🖼 Subir foto</button>
          {!result && scanning && <span style={{ alignSelf:'center', fontSize:12, color:'#888' }}>Usa cámara trasera en móvil</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={(e)=>handlePhotoFile(e.target.files && e.target.files[0])} />

        {result && (
          <div style={{ padding:'12px 16px 16px', borderTop:'1px solid #eee', marginTop:10 }}>
            <p style={{ fontWeight:600, color:'#0a7a33', fontSize:14, margin:'0 0 6px' }}>✅ Código detectado{fromPhoto?' en foto':''}</p>
            <p className="mono" style={{ fontSize:13, wordBreak:'break-all', background:'#e7f6ec', padding:'8px 10px', borderRadius:6, margin:'0 0 10px', color:'#0a3d1e', maxHeight:80, overflow:'auto' }}>{result}</p>
            <p style={{ fontSize:12, color:'#666', margin:'0 0 10px' }}>Modo: <strong>{modoInfo.label}</strong> — {modoInfo.desc}</p>
            {/* Acciones legacy (cuando no hay lookup) */}
            {onSave && !onResult && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button className="btn" onClick={()=>handleSave('producto')} disabled={saving}>{saving?'Guardando…':'⚙ Producto'}</button>
                <button className="btn" onClick={()=>handleSave('proveedor')} disabled={saving}>{saving?'Guardando…':'🏭 Proveedor'}</button>
                <button className="btn" onClick={()=>handleSave('almacen')} disabled={saving}>{saving?'Guardando…':'📦 Almacén'}</button>
                <button className="btn btn-secundario" onClick={handleClose}>Cerrar</button>
              </div>
            )}
            {onResult && (
              <p style={{ fontSize:12, color:'#888' }}>Consultando producto… <button onClick={handleClose} style={{ marginLeft:8 }}>Cerrar y ver detalle</button></p>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes scanline { from { top: 0 } to { top: calc(100% - 2px) } }`}</style>
    </div>
  );
}

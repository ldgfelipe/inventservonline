'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * ScanModal — ventana de escaneo de código QR / código de barras.
 * Lanza la cámara vía getUserMedia, lee QR / EAN / CODE128 con jsQR (CDN),
 * y muestra el resultado con opciones de guardado.
 */
export default function ScanModal({ open, onClose, onSave }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const jsqrReadyRef = useRef(false);
  const loadJsQR = () => new Promise((resolve, reject) => {
    if ((window.jsQR && window.jsQRReady) || jsqrReadyRef.current) return resolve();
    if (document.getElementById('jsqr-cdn')) { jsqrReadyRef.current = true; return resolve(); }
    const s = document.createElement('script');
    s.id = 'jsqr-cdn';
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = () => { jsqrReadyRef.current = true; resolve(); };
    s.onerror = () => reject(new Error('No se pudo cargar jsQR'));
    document.head.appendChild(s);
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    setResult(null);

    async function startCamera() {
      try {
        const constraints = {
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stopCamera(); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        loadJsQR().then(() => startScan()).catch((e) => {
          setError(e.message + ' Revisa tu conexión a internet.');
        });
      } catch (e) {
        setError('No se pudo acceder a la cámara. Intenta en HTTPS o con permiso.');
      }
    }

    function stopCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) { rafRef.current = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d', { width: canvas.width, height: canvas.height });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(src.data, src.width, src.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          setResult(String(code.data).trim());
          stopCamera();
          onClose();
        }
      } catch { /* ignorar lecturas fallidas */ }
      rafRef.current = requestAnimationFrame(loop);
    }

    async function startScan() {
      setScanning(true);
      // primer frame para dar tiempo a la carga
      await new Promise((r) => setTimeout(r, 300));
      loop();
    }

    startCamera();

    return () => { cancelled = true; stopCamera(); };
  }, [open]);

  function handleSave(type) {
    if (!result) return;
    setSaving(true);
    onSave(result, type, () => { setSaving(false); });
  }

  function handleClose() {
    setResult(null);
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    onClose();
  }

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={handleClose}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
        maxWidth: 520, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Cabezona */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f4f4f4' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Digitaliza código</span>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#333' }} aria-label="cerrar">&#10005;</button>
        </div>

        {/* Video de escaneo */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3', margin: '12px 16px', overflow: 'hidden' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {scanning && <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 14 }}>Escaneando… apunta al código</div>}
          {error && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '12px 16px', borderRadius: 8, fontSize: 13, maxWidth: '80%' }}>{error}</div>}
        </div>

        {/* Mensajes */}
        {result && !scanning && (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p style={{ fontWeight: 600, color: '#0077b5' }}>✅ Código detectado:</p>
            <p className="mono" style={{
              fontSize: 16, fontWeight: 700, wordBreak: 'break-all', letterSpacing: 1,
              background: '#f0f8ff', padding: '12px 16px', borderRadius: 8, marginTop: 8, marginBottom: 16,
              maxHeight: 120, overflow: 'auto',
            }}>{result}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => handleSave('producto')}>⚙ Guardar como producto</button>
              <button className="btn" onClick={() => handleSave('proveedor')}>🏭 Guardar como proveedor</button>
              <button className="btn" onClick={() => handleSave('almacen')}>📦 Guardar como almacén</button>
              <button className="btn btn-secundario" onClick={handleClose}>Cancelar</button>
            </div>
          </div>
        )}
        {!result && scanning && (
          <div style={{ padding: 24, color: '#aaa', textAlign: 'center', fontSize: 14 }}>
            📱 Apunta el código QR / barcode al rostro de la cámara
          </div>
        )}
      </div>
    </div>
  );
}

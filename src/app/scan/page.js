'use client';

import { useState } from 'react';
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';
import Footer from '@/components/Footer';
import ScanModal from '@/components/ScanModal';
import { useRouter } from 'next/navigation';

export default function ScanPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [savedId, setSavedId] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');

  async function handleSave(code, type, confirmCb) {
    try {
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_type: type, code, nombre: '' }),
      });
      const j = await r.json();
      if (!r.ok && j.error) throw new Error(j.error);
      setSavedId(j.id);
      setSavedMsg(`✅ Guardado como ${type === 'producto' ? 'producto' : type === 'proveedor' ? 'proveedor' : 'almacén'}`);
      confirmCb();
      setTimeout(() => { setSavedMsg(''); setTimeout(() => router.push('/panel'), 1500); }, 800);
    } catch (e) {
      alert('Error guardando: ' + e.message);
      confirmCb();
    }
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: 'https://inventser.online/scan',
        name: 'inventserOnline - Digitaliza código QR',
        description: 'Digitaliza QR / barcodes para guardar productos, proveedores o almacenes.',
      }) }} />

      <header className="landing-header">
        <Link href="/" className="landing-marca" aria-label="inventserOnline">
          <img src="/logo.png" alt="inventserOnline" className="landing-logo" width="96" height="52" />
          <span className="landing-tagline">Sistema de Inventarios</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
          <a href="/panel"><button style={{ background: '#0077b5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 500, fontSize: 14 }}>Ir al panel</button></a>
          <GoogleTranslate />
        </nav>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center', padding: '20px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Digitaliza tu código</h1>
        <p style={{ color: '#555', maxWidth: 480, fontSize: 16, lineHeight: 1.6 }}>
          Sube o escanea un QR / código de barras. Se guardará automáticamente como <strong>producto</strong>,
          <strong>proveedor</strong> o <strong>almacén</strong>. Ideal paraWhatsApp — envía el link <code>we.me/#scan</code> por el
          cuerpo para que un cliente escanee su código desde su celular.
        </p>

        {savedMsg && <div style={{ background: '#d4edda', color: '#155724', padding: '12px 24px', borderRadius: 8, marginTop: 24, fontSize: 15 }}>{savedMsg}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-secundario" onClick={() => { setOpen(false); router.push('/entrar'); }}>Entrar al sistema</button>
          <button className="btn" onClick={() => setOpen(true)}>📷 Escanear ahora</button>
          <Link className="btn btn-secundario" href="/registro">Registrar cuenta</Link>
        </div>

        <div style={{ marginTop: 24, color: '#888', fontSize: 13 }}>
          📱 Abre esta página en un celular para que funcione la cámara nativa.
          Si usas WhatsApp, envía <code>https://inventser.online/scan</code> o <code>we.me/#scan</code>.
        </div>
      </main>

      <Footer />
      <ScanModal open={open} onClose={() => setOpen(false)} onSave={handleSave} />
    </>
  );
}

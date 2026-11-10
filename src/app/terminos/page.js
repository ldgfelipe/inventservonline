import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';

export const metadata = {
  title: 'Términos del Servicio — inventserOnline',
  description: 'Términos y condiciones del uso del sistema de inventarios online.',
};

export default function TerminosPage() {
  const fechaActual = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Términos del Servicio — inventserOnline',
        url: 'https://inventser.online/terminos',
        description: 'Términos y condiciones del uso de inventserOnline.',
      }) }} />

      <header className="landing-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <Link href="/" className="landing-marca" aria-label="inventserOnline">
          <img src="/logo.png" alt="inventserOnline" className="landing-logo" width="96" height="52" />
          <span className="landing-tagline">Sistema de Inventarios</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Link href="/precios">Precios</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/entrar">Entrar</Link>
          <Link className="btn" href="/registro">Crear cuenta gratis</Link>
          <GoogleTranslate />
        </nav>
      </header>

      <main className="seo-seccion" style={{ maxWidth: 720, margin: '32px auto 48px', padding: '0 16px' }}>
        <h1>Términos del Servicio</h1>
        <p style={{ color: '#666', fontSize: 14 }}>Última actualización: {fechaActual}</p>

        <h2>1. Aceptación</h2>
        <p>Al usar inventserOnline aceptas estos Términos. Si no los aceptas, no debes usar el servicio.</p>

        <h2>2. Descripción del servicio</h2>
        <p>inventserOnline es un sistema de gestión de inventarios online (SaaS) basado en navegador.</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Controlar stock, entradas y salidas.</li>
          <li>Gestión de múltiples almacenes y traslados.</li>
          <li>Ventas, compras, CxC/CpC.</li>
          <li>Facturación electrónica según normativa local.</li>
          <li>Escanear códigos QR/barcode.</li>
        </ul>

        <h2>3. Registro y cuenta</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Datos reales para la cuenta y empresa.</li>
          <li>Correo de confirmación.</li>
          <li>Eres responsable de la contraseña y token de acceso.</li>
        </ul>

        <h2>4. Permisos y roles</h2>
        <p>Roles: Administrador, Supervisor, Almacenista, Consultor.</p>
        <p>El super_admin crea usuarios y permisos.</p>

        <h2>5. Plan y pagos</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Gratis:</strong> 14 días, hasta 100 productos.</li>
          <li><strong>Basico:</strong> hasta 1.000 productos.</li>
          <li><strong>Profesional:</strong> facturación electrónica.</li>
          <li><strong>Empresa:</strong> traslados, usuarios ilimitados.</li>
        </ul>
        <p>Pagos: Stripe, MercadoPago, PayPal o transferencia bancaria.</p>

        <h2>6. Responsabilidad</h2>
        <p>Servicio “tal cual”. No somos responsables de interrupciones, pérdida de datos o retrasos de facturación.</p>

        <h2>7. Propiedad intelectual</h2>
        <p>Todo el contenido y código son propiedad de inventser.online. No puedes reproducir sin autorización.</p>

        <h2>8. Suspensión y cancelación</h2>
        <p>Puedes cancelar en configuración. Cancelación notificada 7 días antes. Tuiviad se eliminan en 30 días.</p>
        <p>Suspensión por uso fraudulento o violación de Términos.</p>

        <h2>9. Ley aplicable</h2>
        <p>Normativa del país configurado. Jurisdicción Ciudad de México.</p>

        <h2>10. Modificaciones</h2>
        <p>Puedemos actualizar los Términos con notificación).</p>

        <div style={{ background: '#fff7ed', border: '1px solid #fDBA74', borderRadius: 8, padding: 12, marginTop: 24, fontSize: 13, color: '#78350f' }}>
          <strong>Contacto:</strong> contacto@inventser.online
        </div>
      </main>

      <footer className="landing-footer" style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, padding: '24px 16px 16px', fontSize: 13, color: '#666' }}>
          <div>
            <strong style={{ fontSize: 14 }}>inventserOnline</strong>
            <p style={{ margin: 4 }}>Sistema de Inventarios Online · Funciona en la nube</p>
            <p style={{ margin: 4 }}>© {new Date().getFullYear()}. Todos los derechos reservados.</p>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', maxWidth: '200px' }}>
            <Link href="/precios">Precios</Link>
            <Link href="/terminos">Términos</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/mapa-del-sitio">Mapa</Link>
          </div>
          <div>
            <strong>-contacto</strong>
            <a href="https://wa.me/522227328662" target="_blank" rel="noopener" style={{ display: 'block', marginTop: 4 }}>📱 WhatsApp: 2227328662</a>
            <a href="mailto:contacto@inventser.online" style={{ display: 'block', marginTop: 4 }}>✉️ contacto@inventser.online</a>
          </div>
        </div>
      </footer>
    </>
  );
}
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';

export const metadata = {
  title: 'Aviso de Privacidad — inventserOnline',
  description: 'Política de privacidad de inventserOnline. Información sobre datos, cookies y derechos del usuario.',
};

export default function PrivacidadPage() {
  const fechaActual = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Aviso de Privacidad — inventserOnline',
        url: 'https://inventser.online/privacidad',
        description: 'Política de privacidad de inventserOnline.',
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
        <h1>Privacidad</h1>
        <p style={{ color: '#666', fontSize: 14 }}>Última actualización: {fechaActual}</p>

        <h2>1. Información que recopilamos</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Datos de registro:</strong> nombre, apellido, email, empresa, país, moneda, giro, logo.</li>
          <li><strong>Datos de navegación:</strong> IP, user-agent, visitas y métricas vía Google Tag Manager.</li>
          <li><strong>Datos de uso:</strong> productos, proveedores, almacenes y movimientos.</li>
          <li><strong>Datos de factura:</strong> RFC, NIT, provedor, comprobantes electrónicos.</li>
        </ul>

        <h2>2. Uso de la información</h2>
        <p>Proveer y mejorar el servicio, autenticación, notificaciones y cumplimiento legal.</p>

        <h2>3. Compartir con terceros</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Facturación electrónica:</strong> únicamente los datos estrictamente necesarios.</li>
          <li><strong>No vendemos ni alquilamos datos personales.</strong></li>
        </ul>

        <h2>4. Cookies y seguimiento</h2>
        <p>Google Translate y Google Tag Manager. Puedes desactivar tags en GTM.</p>

        <h2>5. Seguridad</h2>
        <p>HTTPS, JWT, permisos por rol y separación de datos por empresa.</p>

        <h2>6. Tus derechos</h2>
        <p>Ejercer derechos de acceso, rectificación y supresión vía <a href="mailto:contacto@inventser.online">contacto@inventser.online</a>.</p>

        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginTop: 24, fontSize: 3, color: '#555' }}>
          <strong>Nota:</strong> Documento genérico. Para casos específicos consulta a un experto legal.
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
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="footer-marca">
        <img src="/logo.png" alt="inventserOnline" className="footer-logo" />
        <div>
          <div className="footer-nombre">inventserOnline</div>
          <div className="footer-tagline">Sistema de Inventarios Online · Funciona en la nube, sin instalar nada</div>
        </div>
      </div>

      <div className="footer-contacto">
        <h4>Contacto</h4>
        <a href="https://wa.me/522227328662" target="_blank" rel="noopener" className="footer-enlace">
          <span className="footer-icono">&#128241;</span> WhatsApp: 2227328662
        </a>
        <a href="mailto:contacto@inventser.online" className="footer-enlace">
          <span className="footer-icono">&#9993;</span> contacto@inventser.online
        </a>
      </div>

      <div className="footer-mensaje">
        <h4>Sistemas personalizados</h4>
        <p>
          Si requieres un sistema personalizado, puedes contactarnos para mayor informacion.
          Desarrollamos soluciones a medida para tu negocio.
        </p>
      </div>

      <div className="footer-base">
        © {new Date().getFullYear()} inventserOnline. Todos los derechos reservados ·{' '}
        <Link href="/mapa-del-sitio" style={{ color: 'inherit', textDecoration: 'underline' }}>
          Mapa del sitio
        </Link>
      </div>
    </footer>
  );
}

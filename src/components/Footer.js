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

      <div className="footer-enlaces">
        <h4>Enlaces</h4>
        <Link href="/precios">Precios</Link>
        <Link href="/terminos">Términos del Servicio</Link>
        <Link href="/privacidad">Aviso de Privacidad</Link>
        <Link href="/mapa-del-sitio">Mapa del Sitio</Link>
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

      <div className="footer-base">
        © {new Date().getFullYear()} inventserOnline. Todos los derechos reservados.
      </div>
    </footer>
  );
}

import Link from 'next/link';
import { t } from '@/lib/i18n';

export default function Footer({ lang = 'es' }) {
  const tl = (key) => t(key, lang);
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
        <h4>{tl('footer_contact_title')}</h4>
        <a href="https://wa.me/522227328662" target="_blank" rel="noopener" className="footer-enlace">
          <span className="footer-icono">&#128241;</span> WhatsApp: 2227328662
        </a>
        <a href="mailto:contacto@inventser.online" className="footer-enlace">
          <span className="footer-icono">&#9993;</span> contacto@inventser.online
        </a>
      </div>

      <div className="footer-mensaje">
        <h4>{tl('footer_custom_systems_title')}</h4>
        <p>
          {tl('footer_custom_systems_desc1')}<br />
          {tl('footer_custom_systems_desc2')}
        </p>
      </div>

      <div className="footer-base">
        &copy; {new Date().getFullYear()} inventserOnline. Todos los derechos reservados ·{' '}
        <Link href="/mapa-del-sitio" style={{ color: 'inherit', textDecoration: 'underline' }}>
          {tl('footer_site_map')}
        </Link>
      </div>
    </footer>
  );
}

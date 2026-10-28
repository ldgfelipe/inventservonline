import './globals.css';
import { leerConfigSitio, snippetGa4, snippetGtmHead } from '@/lib/config-sitio';

const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventser.online').replace(/\/+$/, '');

// El layout lee la configuracion de pixeles en cada peticion para que los
// scripts esten en el HTML inicial (antes de la hidratacion) y Google los
// detecte desde la primera carga.
export const dynamic = 'force-dynamic';

export const metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: 'Sistema de Inventarios Online | inventserOnline',
    template: '%s · inventserOnline',
  },
  description: 'Sistema de inventarios online para controlar stock, ventas, compras, almacenes y facturacion sin Excel. Prueba gratis 14 dias.',
  keywords: [
    'sistema de inventarios',
    'control de inventario',
    'software de inventario',
    'inventario online',
    'gestion de almacenes',
    'control de stock',
    'sistema de almacen',
    'inventario para empresas',
    'programa de inventario',
    'facturacion electronica',
  ],
  applicationName: 'inventserOnline',
  authors: [{ name: 'inventserOnline', url: BASE }],
  creator: 'inventserOnline',
  publisher: 'inventserOnline',
  category: 'business',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: BASE,
    siteName: 'inventserOnline',
    title: 'Sistema de Inventarios Online | inventserOnline',
    description: 'Controla stock, ventas, compras y almacenes desde cualquier equipo. Sin Excel. Prueba gratis 14 dias.',
    images: [{ url: '/logo.png', width: 760, height: 410, alt: 'inventserOnline - Sistema de Inventarios' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sistema de Inventarios Online | inventserOnline',
    description: 'Controla stock, ventas, compras y almacenes sin Excel. Prueba gratis 14 dias.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

/* Separa los scripts (JS ejecutable) del resto del HTML. Los scripts inyectados
   por innerHTML NO se ejecutan, asi que hay que renderizarlos como <script>. */
function extraerScripts(codigo) {
  const scripts = [];
  const html = String(codigo || '').replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs, body) => {
    const src = /src\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (src) scripts.push({ src: src[1], code: '' });
    else scripts.push({ src: '', code: body.trim() });
    return '';
  }).trim();
  return { scripts, html };
}

export default async function RootLayout({ children }) {
  const cfg = await leerConfigSitio({ force: true });
  const gtmHead = snippetGtmHead(cfg.gtm_id);
  const gaJs = snippetGa4(cfg.ga_measurement_id);

  const headExtra = extraerScripts(cfg.head_code);
  const bodyOpenExtra = extraerScripts(cfg.body_open_code);
  const bodyCloseExtra = extraerScripts(cfg.body_close_code);

  return (
    <html lang="es">
      <head>
        {gtmHead && <script dangerouslySetInnerHTML={{ __html: gtmHead }} />}
        {cfg.ga_measurement_id && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga_measurement_id)}`} />
            <script dangerouslySetInnerHTML={{ __html: gaJs }} />
          </>
        )}
        {headExtra.scripts.map((s, i) =>
          s.src
            ? <script key={`hs-${i}`} src={s.src} async />
            : <script key={`hs-${i}`} dangerouslySetInnerHTML={{ __html: s.code }} />
        )}
        {headExtra.html && <div dangerouslySetInnerHTML={{ __html: headExtra.html }} />}
      </head>
      <body>
        {bodyOpenExtra.scripts.map((s, i) =>
          s.src
            ? <script key={`bo-${i}`} src={s.src} async />
            : <script key={`bo-${i}`} dangerouslySetInnerHTML={{ __html: s.code }} />
        )}
        {bodyOpenExtra.html && <div dangerouslySetInnerHTML={{ __html: bodyOpenExtra.html }} />}
        {cfg.gtm_id && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(cfg.gtm_id)}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        {children}
        {bodyCloseExtra.scripts.map((s, i) =>
          s.src
            ? <script key={`bc-${i}`} src={s.src} async />
            : <script key={`bc-${i}`} dangerouslySetInnerHTML={{ __html: s.code }} />
        )}
        {bodyCloseExtra.html && <div dangerouslySetInnerHTML={{ __html: bodyCloseExtra.html }} />}
      </body>
    </html>
  );
}

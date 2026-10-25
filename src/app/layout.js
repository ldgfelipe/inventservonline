import './globals.css';
import { leerConfigSitio, snippetGa4, snippetGtmHead } from '@/lib/config-sitio';

const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventservonline.vercel.app').replace(/\/+$/, '');

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

/* Si el admin pega un snippet completo con <script>, dejamos solo el JS
   para poder insertarlo en un <script> real (los scripts inyectados por
   innerHTML no se ejecutan). */
function soloJs(codigo) {
  return String(codigo || '')
    .replace(/<script[^>]*>/gi, '')
    .replace(/<\/script>/gi, '')
    .trim();
}

export default async function RootLayout({ children }) {
  const cfg = await leerConfigSitio();
  const gtmHead = snippetGtmHead(cfg.gtm_id);
  const gaJs = snippetGa4(cfg.ga_measurement_id);
  const headJs = soloJs(cfg.head_code);
  const bodyOpenJs = soloJs(cfg.body_open_code);
  const bodyCloseJs = soloJs(cfg.body_close_code);

  return (
    <html lang="es">
      <head>
        {gtmHead && <script dangerouslySetInnerHTML={{ __html: gtmHead }} />}
        {cfg.ga_measurement_id && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${cfg.ga_measurement_id}`} />
            <script dangerouslySetInnerHTML={{ __html: gaJs }} />
          </>
        )}
        {headJs && <script dangerouslySetInnerHTML={{ __html: headJs }} />}
      </head>
      <body>
        {bodyOpenJs && <script dangerouslySetInnerHTML={{ __html: bodyOpenJs }} />}
        {cfg.gtm_id && <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${cfg.gtm_id}`} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} /></noscript>}
        {children}
        {bodyCloseJs && <script dangerouslySetInnerHTML={{ __html: bodyCloseJs }} />}
      </body>
    </html>
  );
}

import './globals.css';
import PixelesSitio from '@/components/PixelesSitio';

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

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        <PixelesSitio />
      </body>
    </html>
  );
}

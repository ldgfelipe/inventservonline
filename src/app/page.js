import Landing from '@/components/Landing';

const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventser.online').replace(/\/+$/, '');

export const metadata = {
  metadataBase: new URL(BASE),
  title: 'Sistema de Inventarios Online | Control de stock, ventas y almacenes',
  description: 'Sistema de inventarios online para controlar stock, ventas, compras, almacenes y facturacion sin Excel. Prueba gratis 14 dias.',
  keywords: [
    'sistema de inventarios', 'control de inventario', 'software de inventario', 'inventario online', 'gestion de almacenes', 'control de stock', 'sistema de almacen', 'inventario para empresas',
    'programa de inventario', 'facturacion electronica', 'punto de venta', 'kardex', 'inventario multi almacen', 'alternativa a Excel para inventarios',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', locale: 'es_MX', url: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventser.online'.replace(/\/+$/, ''), siteName: 'inventserOnline',
    title: 'Sistema de Inventarios Online | inventserOnline',
    description: 'Controla stock, ventas, compras y almacenes desde cualquier equipo. Sin Excel. Prueba gratis 14 dias.',
    images: [{ url: '/logo.png', width: 760, height: 410, alt: 'inventserOnline - Sistema de Inventarios' }],
  },
  twitter: { card: 'summary_large_image', title: 'Sistema de Inventarios Online | inventserOnline', description: 'Controla stock, ventas, compras y almacenes sin Excel. Prueba gratis 14 dias.', images: ['/logo.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
};

export default function Page() {
  return <Landing />;
}

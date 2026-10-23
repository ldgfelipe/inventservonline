import './globals.css';

export const metadata = {
  title: 'Sistema de Inventarios Online',
  description: 'Inventario adaptable por giro: construccion, farmacia y mas. Registrate y empieza a usarlo hoy.',
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

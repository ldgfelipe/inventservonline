import './globals.css';

export const metadata = {
  title: 'Sistema de Inventarios Online',
  description: 'Inventario adaptable por giro: construccion, farmacia y mas. Registrate y empieza a usarlo hoy.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

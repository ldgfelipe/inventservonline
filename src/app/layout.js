import './globals.css';
import GoogleTranslate from '@/components/GoogleTranslate';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
        <GoogleTranslate />
      </body>
    </html>
  );
}

import './globals.css';
import GoogleTranslate from '@/components/GoogleTranslate';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          src="https://slt-xi.vercel.app/slt-tracker.js"
          data-site-id="e614ba6d-2396-4bd6-bfaf-869a8ddb1abc"
          data-host="https://slt-xi.vercel.app"
          async
        />
      </head>
      <body>
        {children}
        <GoogleTranslate />
      </body>
    </html>
  );
}
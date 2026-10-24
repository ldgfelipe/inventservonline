import { NextResponse } from 'next/server';

/* Protege el sistema y la API.
   Comprueba que exista una sesion valida (cookie) antes de dejar pasar
   a /panel, /renderer o a cualquier /api/* de datos.

   La validacion FINAL de permisos se hace en cada ruta, contra la base
   de datos: esto es la puerta de entrada, no el control de acceso. */

const PUBLICAS = [
  '/',
  '/entrar',
  '/registro',
  '/api/auth/login',
  '/api/auth/registro',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/giros',
  '/api/giros/',
  '/api/monedas',
  '/api/planes',
  '/api/webhooks',
  '/api/trafico',
  '/api/pixel',
  '/api/click',
  '/api/landing',
  '/precios',
  '/ayuda',
];

function esPublica(ruta) {
  return PUBLICAS.some((p) => ruta === p || ruta.startsWith(p + '/'));
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (esPublica(pathname)) return NextResponse.next();

  const token = request.cookies.get('invetser_token')?.value;
  if (!token) {
    // La API responde 401 para que el puente web mande al login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Sesion no iniciada' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.searchParams.set('expiro', '1');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/panel/:path*', '/admin/:path*', '/renderer/:path*', '/api/:path*'],
};

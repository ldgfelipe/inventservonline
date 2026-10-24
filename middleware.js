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

/* Decodifica el payload de un JWT sin verificar la firma (eso lo hace
   la API contra Supabase). Aqui basta con saber si expiro. */
function tokenVigente(token) {
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
    if (!payload.exp) return false;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (esPublica(pathname)) return NextResponse.next();

  const token = request.cookies.get('invetser_token')?.value;
  if (!token || !tokenVigente(token)) {
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

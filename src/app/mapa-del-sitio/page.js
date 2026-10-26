import Link from 'next/link';
import Footer from '@/components/Footer';
import { admin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mapa del sitio | Páginas públicas',
  description: 'Mapa del sitio de inventserOnline: inicio, planes y precios, base de conocimiento, registro y páginas de campañas. Solo páginas públicas, sin acceso al sistema privado.',
  alternates: { canonical: '/mapa-del-sitio' },
  robots: { index: true, follow: true },
};

export default async function MapaDelSitio() {
  let paginas = [];
  try {
    const sb = admin();
    const { data } = await sb.from('paginas')
      .select('slug, titulo, tipo, updated_at')
      .eq('publicado', true)
      .order('updated_at', { ascending: false });
    paginas = data || [];
  } catch { /* si falta la migracion 036, solo se listan las rutas fijas */ }

  return (
    <>
      <header className="landing-header">
        <Link href="/" className="landing-marca" aria-label="inventserOnline - inicio">
          <img src="/logo.png" alt="inventserOnline" className="landing-logo" width="96" height="52" />
          <span className="landing-tagline">Sistema de Inventarios</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }} aria-label="Navegacion principal">
          <Link href="/precios">Precios</Link>
          <Link href="/ayuda">Ayuda</Link>
          <Link href="/entrar">Entrar</Link>
          <Link className="btn" href="/registro">Crear cuenta gratis</Link>
        </nav>
      </header>

      <main className="seo-seccion" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <h1 style={{ fontSize: 32, marginBottom: 10 }}>Mapa del sitio</h1>
        <p>
          Estas son las páginas públicas de inventserOnline. No incluye el panel privado
          ni el área de administración, que requieren iniciar sesión.
        </p>

        <h2 style={{ marginTop: 28 }}>Páginas principales</h2>
        <ul className="seo-lista">
          <li><Link href="/">Inicio</Link></li>
          <li><Link href="/precios">Planes y precios</Link></li>
          <li><Link href="/ayuda">Base de conocimiento</Link></li>
          <li><Link href="/registro">Crear cuenta gratis</Link></li>
        </ul>

        <h2 style={{ marginTop: 28 }}>Páginas de campañas y blog</h2>
        {paginas.length === 0 ? (
          <p>Todavía no hay páginas de campaña publicadas.</p>
        ) : (
          <ul className="seo-lista">
            {paginas.map((p) => (
              <li key={p.slug}>
                <Link href={'/p/' + p.slug}>{p.titulo}</Link>
                {p.tipo === 'blog' ? ' · Blog' : ''}
              </li>
            ))}
          </ul>
        )}

        <h2 style={{ marginTop: 28 }}>Otros enlaces</h2>
        <ul className="seo-lista">
          <li><Link href="/entrar">Iniciar sesión</Link></li>
          <li><Link href="/baja">Darse de baja de correos</Link></li>
          <li><a href="/sitemap.xml">Sitemap XML para buscadores</a></li>
        </ul>
      </main>

      <Footer />
    </>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Landing() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function probarDemo() {
    setCargando(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@abarrotes.com', password: 'demo123456' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo iniciar sesion');

      localStorage.setItem('inventarios_sesion', JSON.stringify({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
      }));
      document.cookie = `invetser_token=${j.access_token}; path=/; max-age=2592000; SameSite=Lax`;
      router.push('/panel');
    } catch (err) {
      alert('No se pudo iniciar sesion demo: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <header className="landing-header">
        <Link href="/" className="landing-marca" aria-label="inventserOnline - inicio">
          <img src="/logo.png" alt="inventserOnline" className="landing-logo" />
          <span className="landing-tagline">Sistema de Inventarios</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Link href="/precios">Precios</Link>
          <Link href="/ayuda">Ayuda</Link>
          <Link href="/entrar">Entrar</Link>
          <Link className="btn" href="/registro">Crear cuenta gratis</Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-badge">14 dias de prueba gratis · Sin tarjeta</div>
          <h1>Inventario que se adapta a tu negocio</h1>
          <p className="lead">
            Construccion, farmacia, abarrotes o cualquier otro giro. Configura tus propios campos,
            controla entradas y salidas, y consulta todo desde cualquier equipo.
          </p>
          <div className="hero-acciones">
            <button className="btn btn-demo" onClick={probarDemo} disabled={cargando}>
              {cargando ? 'Entrando...' : 'Probar el sistema'}
            </button>
            <Link className="btn" href="/registro">Empieza gratis</Link>
            <Link className="btn btn-secundario" href="/precios">Ver planes y precios</Link>
          </div>
          <p className="texto-demo">
            Cuenta demo: <code>demo@abarrotes.com</code> / <code>demo123456</code> · Tienda de abarrotes lista para probar
          </p>
        </section>

        <section className="beneficios">
          <div className="beneficio">
            <div className="icono">&#128176;</div>
            <h3>Planes desde $0</h3>
            <p>Empieza gratis y sube a Basico, Profesional o Empresa cuando tu negocio lo necesite. Sin permanencia.</p>
            <Link href="/precios" className="btn-enlace" style={{ marginTop: 10, display: 'inline-block' }}>
              Comparar planes →
            </Link>
          </div>
          <div className="beneficio">
            <div className="icono">&#9635;</div>
            <h3>Se adapta a tu giro</h3>
            <p>Construccion, farmacia, abarrotes o cualquier otro giro. Configura tus propios campos sin tocar codigo.</p>
          </div>
          <div className="beneficio">
            <div className="icono">&#8646;</div>
            <h3>Entradas y salidas</h3>
            <p>Registra cada movimiento con trazabilidad: quien lo hizo, cuando y desde que area.</p>
          </div>
          <div className="beneficio">
            <div className="icono">&#9776;</div>
            <h3>Reportes y Excel</h3>
            <p>Exporta tu inventario y movimientos a Excel, o imprime reportes desde el navegador.</p>
          </div>
          <div className="beneficio">
            <div className="icono">&#10022;</div>
            <h3>Asistente incluido</h3>
            <p>Pregunta en lenguaje natural: &ldquo;¿cuanto cemento tengo?&rdquo; o pide registrar una entrada.</p>
          </div>
          <div className="beneficio">
            <div className="icono">&#9679;</div>
            <h3>Usuarios y permisos</h3>
            <p>Administrador, supervisor, almacenista o consultor. Cada rol ve y hace solo lo que le corresponde.</p>
          </div>
          <div className="beneficio">
            <div className="icono">&#9632;</div>
            <h3>Carga masiva</h3>
            <p>Importa tu catalogo desde CSV o Excel. Detecta duplicados y te muestra una vista previa antes de aplicar.</p>
          </div>
        </section>

        <section className="personalizado">
          <div className="personalizado-contenido">
            <h2>¿Necesitas un sistema a medida?</h2>
            <p>
              Si tu negocio requiere modulos especiales, integraciones con otros sistemas
              o una solucion personalizada, podemos desarrollarla para ti.
            </p>
            <div className="personalizado-acciones">
              <a className="btn" href="https://wa.me/522227328662" target="_blank" rel="noopener">
                Contactar por WhatsApp
              </a>
              <a className="btn btn-secundario" href="mailto:ldgframe@gmail.com">
                Escribir por correo
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-marca">
          <img src="/logo.png" alt="inventserOnline" className="footer-logo" />
          <div>
            <div className="footer-nombre">inventserOnline</div>
            <div className="footer-tagline">Sistema de Inventarios Online · Funciona en la nube, sin instalar nada</div>
          </div>
        </div>

        <div className="footer-contacto">
          <h4>Contacto</h4>
          <a href="https://wa.me/522227328662" target="_blank" rel="noopener" className="footer-enlace">
            <span className="footer-icono">&#128241;</span> WhatsApp: 2227328662
          </a>
          <a href="mailto:ldgframe@gmail.com" className="footer-enlace">
            <span className="footer-icono">&#9993;</span> ldgframe@gmail.com
          </a>
        </div>

        <div className="footer-mensaje">
          <h4>Sistemas personalizados</h4>
          <p>
            Si requieres un sistema personalizado, puedes contactarnos para mayor informacion.
            Desarrollamos soluciones a medida para tu negocio.
          </p>
        </div>

        <div className="footer-base">
          © {new Date().getFullYear()} inventserOnline. Todos los derechos reservados.
        </div>
      </footer>
    </>
  );
}

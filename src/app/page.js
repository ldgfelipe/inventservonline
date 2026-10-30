import Link from 'next/link';
import Footer from '@/components/Footer';
import DemoButton from '@/components/DemoButton';
import LanguageToggle from '@/components/LanguageToggle';
import { catalogoPlanes } from '@/lib/planes';

const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventser.online').replace(/\/+$/, '');

export const metadata = {
  title: 'Sistema de Inventarios Online | Control de stock, ventas y almacenes',
  description: 'Sistema de inventarios online para controlar stock, ventas, compras, almacenes y facturacion sin Excel. Prueba gratis 14 dias. Ideal para ferreterias, farmacias, abarrotes y mas.',
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
    'sistema de ventas e inventario',
    'facturacion electronica',
    'punto de venta',
    'kardex',
    'inventario multi almacen',
    'alternativa a Excel para inventarios',
  ],
  alternates: { canonical: '/' },
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

const FAQS = [
  {
    q: '¿Qué es inventserOnline?',
    a: 'Es un sistema de inventarios online que permite controlar el stock, registrar entradas y salidas, gestionar varios almacenes, ventas, compras, cuentas por cobrar y por pagar, y consultar reportes desde cualquier navegador, sin instalar nada.',
  },
  {
    q: '¿Sirve para cualquier tipo de negocio?',
    a: 'Sí. Se adapta a ferreterías, farmacias, abarrotes, construcción, repuestos, cosméticos, papelerías y cualquier giro. Cada empresa configura sus propios campos de producto, categorías y almacenes.',
  },
  {
    q: '¿Puedo probarlo gratis?',
    a: 'Sí. Todas las cuentas nuevas incluyen 14 días de prueba gratis con las funciones del plan Profesional. No se requiere tarjeta de crédito para comenzar.',
  },
  {
    q: '¿Puedo dejar de usar Excel?',
    a: 'Sí. inventserOnline reemplaza las hojas de cálculo para el control de inventario: registra movimientos con trazabilidad, calcula el kardex valorizado, alerta sobre stock bajo y permite exportar a Excel cuando lo necesites.',
  },
  {
    q: '¿Funciona con varios almacenes o sucursales?',
    a: 'Sí. Los planes Profesional y Empresa incluyen multi-almacén, traslados entre bodegas, stock por almacén y reportes de rendimiento por ubicación.',
  },
  {
    q: '¿Incluye facturación electrónica?',
    a: 'Sí, según el país y el proveedor fiscal configurado. El sistema soporta Facturama y SW Sapien en México, DIAN en Colombia, AFIP en Argentina, SUNAT en Perú, SII en Chile, AEAT en España y timbrado manual en otros casos.',
  },
  {
    q: '¿Cómo se pagan los planes?',
    a: 'Puedes pagar con Stripe, Mercado Pago, PayPal o transferencia bancaria. El administrador de la plataforma habilita los medios disponibles y los pagos se confirman automáticamente.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'La plataforma usa autenticación, permisos por rol y separación de datos por empresa. Cada usuario ve únicamente la información de su organización y los movimientos quedan registrados en la bitácora.',
  },
];

export default function Landing() {
  const planes = catalogoPlanes();
  const pagos = planes.filter((p) => p.precio.mensual > 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': BASE + '/#organizacion',
        name: 'inventserOnline',
        url: BASE,
        logo: BASE + '/logo.png',
        description: 'Sistema de inventarios online para empresas.',
        contactPoint: [{
          '@type': 'ContactPoint',
          telephone: '+522227328662',
          email: 'contacto@inventser.online',
          contactType: 'customer service',
          availableLanguage: ['es'],
        }],
      },
      {
        '@type': 'WebSite',
        '@id': BASE + '/#sitio',
        url: BASE,
        name: 'inventserOnline',
        inLanguage: 'es',
        publisher: { '@id': BASE + '/#organizacion' },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': BASE + '/#software',
        name: 'inventserOnline',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: BASE,
        description: 'Sistema de inventarios online con control de stock, ventas, compras, multi-almacén, facturación electrónica y reportes.',
        featureList: [
          'Control de inventario y stock en tiempo real',
          'Entradas y salidas con trazabilidad',
          'Multi-almacén y traslados entre bodegas',
          'Ventas, compras, cuentas por cobrar y por pagar',
          'Kardex valorizado y reportes',
          'Facturación electrónica',
          'Asistente de inventario en lenguaje natural',
          'Usuarios y permisos por rol',
        ],
        offers: planes.map((p) => ({
          '@type': 'Offer',
          name: p.nombre,
          price: String(p.precio.mensual),
          priceCurrency: p.precio.moneda,
          description: p.descripcion,
          url: BASE + '/precios',
        })),
      },
      {
        '@type': 'FAQPage',
        '@id': BASE + '/#preguntas',
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="landing-header">
        <Link href="/" className="landing-marca" aria-label="inventserOnline - inicio">
          <img src="/logo.png" alt="inventserOnline - Sistema de Inventarios Online" className="landing-logo" width="96" height="52" />
          <span className="landing-tagline">Sistema de Inventarios</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }} aria-label="Navegacion principal">
          <Link href="/precios">Precios</Link>
          <Link href="/ayuda">Ayuda</Link>
          <Link href="/entrar">Entrar</Link>
          <Link className="btn" href="/registro">Crear cuenta gratis</Link>
          <LanguageToggle />
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="titulo-principal">
          <div className="hero-badge">14 dias de prueba gratis · Sin tarjeta</div>
          <h1 id="titulo-principal">Sistema de inventarios online para controlar tu stock sin Excel</h1>
          <p className="lead">
            Controla entradas, salidas, ventas, compras y almacenes desde cualquier equipo.
            inventserOnline se adapta a tu giro y te da reportes claros para tomar mejores decisiones.
          </p>
          <div className="hero-acciones">
            <DemoButton />
            <Link className="btn" href="/registro">Empieza gratis</Link>
            <Link className="btn btn-secundario" href="/precios">Ver planes y precios</Link>
          </div>
          <p className="texto-demo">
            Cuenta demo: <code>demo@abarrotes.com</code> / <code>demo123456</code> · Tienda de abarrotes lista para probar
          </p>
        </section>

        <section className="seo-seccion" aria-labelledby="que-es">
          <h2 id="que-es">¿Qué es inventserOnline?</h2>
          <p>
            inventserOnline es un <strong>sistema de inventarios online</strong> pensado para pequeñas y medianas
            empresas que necesitan dejar atrás las hojas de cálculo. Permite registrar cada entrada y salida de
            mercancía, conocer el stock disponible en tiempo real, organizar productos por categorías y trabajar
            con uno o varios almacenes.
          </p>
          <p>
            Además del inventario, integra <strong>ventas, compras, cuentas por cobrar, cuentas por pagar, caja,
            kardex valorizado y facturación electrónica</strong>. Todo desde el navegador, sin instalar programas
            y con permisos por rol para que cada área vea solo lo que necesita.
          </p>
        </section>

        <section className="beneficios" aria-labelledby="funciones">
          <h2 id="funciones" className="seo-titulo-centrado">Todo lo que necesitas para tu inventario</h2>
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
          <div className="beneficio">
            <div className="icono">&#9878;</div>
            <h3>Multi-almacen</h3>
            <p>Controla existencias por bodega, registra traslados y consulta el stock de cada ubicación.</p>
          </div>
        </section>

        <section className="seo-seccion" aria-labelledby="para-quien">
          <h2 id="para-quien">¿Para qué tipo de negocios sirve?</h2>
          <p>
            El sistema de inventario se adapta a negocios que manejan productos físicos y necesitan saber
            cuánto tienen, cuánto vendieron y cuánto deben pedir. Es útil para:
          </p>
          <ul className="seo-lista">
            <li>Ferreterías y materiales de construcción</li>
            <li>Farmacias y distribuidoras de medicamentos</li>
            <li>Abarrotes, minisúpers y tiendas de conveniencia</li>
            <li>Repuestos, autopartes y talleres</li>
            <li>Cosméticos, papelerías y tiendas de retail</li>
            <li>Distribuidores mayoristas y bodegas</li>
            <li>Restaurantes y negocios con insumos</li>
          </ul>
        </section>

        <section className="seo-seccion" aria-labelledby="como-funciona">
          <h2 id="como-funciona">¿Cómo funciona?</h2>
          <div className="seo-pasos">
            <article>
              <span className="seo-paso-numero">1</span>
              <h3>Crea tu cuenta gratis</h3>
              <p>Registra tu empresa, elige tu país y moneda, y define el giro del negocio.</p>
            </article>
            <article>
              <span className="seo-paso-numero">2</span>
              <h3>Carga tus productos</h3>
              <p>Agrega productos manualmente o importa tu catálogo desde CSV o Excel.</p>
            </article>
            <article>
              <span className="seo-paso-numero">3</span>
              <h3>Controla y decide</h3>
              <p>Registra movimientos, revisa reportes y usa el asistente para detectar qué reponer.</p>
            </article>
          </div>
        </section>

        <section className="seo-seccion" aria-labelledby="planes">
          <h2 id="planes">Planes y precios</h2>
          <p>Empieza gratis y cambia de plan cuando lo necesites. Precios en USD.</p>
          <div className="seo-planes">
            {pagos.map((p) => (
              <div key={p.codigo} className="seo-plan">
                <h3>{p.nombre}</h3>
                <div className="seo-plan-precio">${p.precio.mensual}<span>/mes</span></div>
                <p>{p.descripcion}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16 }}>
            <Link className="btn-enlace" href="/precios">Ver comparativo completo de planes →</Link>
          </p>
        </section>

        <section className="seo-seccion" aria-labelledby="preguntas-frecuentes">
          <h2 id="preguntas-frecuentes">Preguntas frecuentes</h2>
          <div className="faq-home">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="personalizado" aria-labelledby="personalizado">
          <div className="personalizado-contenido">
            <h2 id="personalizado">¿Necesitas un sistema a medida?</h2>
            <p>
              Si tu negocio requiere módulos especiales, integraciones con otros sistemas
              o una solución personalizada, podemos desarrollarla para ti.
            </p>
            <div className="personalizado-acciones">
              <a className="btn" href="https://wa.me/522227328662" target="_blank" rel="noopener">
                Contactar por WhatsApp
              </a>
              <a className="btn btn-secundario" href="mailto:contacto@inventser.online">
                Escribir por correo
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

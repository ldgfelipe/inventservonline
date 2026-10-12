import Link from 'next/link';

export default function Landing() {
  return (
    <>
      <header className="landing-header">
        <span className="logo">Sistema de Inventarios</span>
        <nav style={{ display: 'flex', gap: 14 }}>
          <Link href="/entrar">Entrar</Link>
          <Link className="btn" href="/registro">Crear cuenta gratis</Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h1>Inventario que se adapta a tu negocio</h1>
          <p className="lead">
            Construccion, farmacia o cualquier otro giro. Configura tus propios campos,
            controla entradas y salidas, y consulta todo desde cualquier equipo.
          </p>
          <div className="hero-acciones">
            <Link className="btn" href="/registro">Empieza gratis</Link>
            <Link className="btn btn-secundario" href="/entrar">Ya tengo cuenta</Link>
          </div>
        </section>

        <section className="beneficios">
          <div className="beneficio">
            <div className="icono">&#9635;</div>
            <h3>Se adapta a tu giro</h3>
            <p>Elige entre construccion o farmacia, o crea tus propios campos. El sistema se ajusta sin que toques codigo.</p>
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
      </main>

      <footer className="landing-footer">
        Sistema de Inventarios Online · Funciona en la nube, sin instalar nada
      </footer>
    </>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ARTICULOS, CATEGORIAS, buscarArticulos } from '@/lib/baseConocimiento';
import Footer from '@/components/Footer';

export default function Ayuda() {
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [abierto, setAbierto] = useState(null);

  const resultados = useMemo(() => {
    let lista = buscarArticulos(texto);
    if (categoria !== 'todas') lista = lista.filter((a) => a.categoria === categoria);
    return lista;
  }, [texto, categoria]);

  const catNombre = (id) => {
    const c = CATEGORIAS.find((x) => x.id === id);
    return c ? c.nombre : id;
  };

  return (
    <>
    <main className="ayuda">
      <header className="ayuda-header">
        <Link href="/" className="ayuda-logo" aria-label="inventserOnline - inicio">
          <img src="/logo.png" alt="inventserOnline" className="ayuda-logo-img" />
        </Link>
        <nav className="ayuda-nav">
          <Link href="/precios">Precios</Link>
          <Link href="/entrar">Iniciar sesion</Link>
          <Link href="/registro" className="btn btn-primary">Comenzar gratis</Link>
        </nav>
      </header>

      <section className="ayuda-hero">
        <h1>Base de conocimiento</h1>
        <p className="sub">Encuentra como funciona cada seccion del sistema de inventarios.</p>
        <div className="ayuda-buscador">
          <input
            type="search"
            placeholder="Busca: stock, ventas, facturacion, IVA, almacenes..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
          />
          {texto && (
            <button className="btn btn-secundario" onClick={() => setTexto('')}>Limpiar</button>
          )}
        </div>
        <div className="ayuda-chips">
          <button
            className={`chip ${categoria === 'todas' ? 'activo' : ''}`}
            onClick={() => setCategoria('todas')}
          >
            Todas
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              className={`chip ${categoria === c.id ? 'activo' : ''}`}
              onClick={() => setCategoria(c.id)}
            >
              {c.icono} {c.nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="ayuda-resultados">
        <div className="ayuda-contador">
          {resultados.length} articulo{resultados.length === 1 ? '' : 's'}
          {texto ? ` para "${texto}"` : ''}
        </div>

        {resultados.length === 0 && (
          <div className="ayuda-vacio">
            <p>No encontramos articulos para tu busqueda.</p>
            <button className="btn btn-secundario" onClick={() => { setTexto(''); setCategoria('todas'); }}>
              Ver todos los articulos
            </button>
          </div>
        )}

        <div className="ayuda-lista">
          {resultados.map((a) => (
            <article key={a.id} className="ayuda-articulo">
              <button
                className="ayuda-articulo-header"
                onClick={() => setAbierto(abierto === a.id ? null : a.id)}
              >
                <div>
                  <span className="ayuda-cat">{catNombre(a.categoria)}</span>
                  <h2>{a.titulo}</h2>
                  <p>{a.descripcion}</p>
                </div>
                <span className="ayuda-toggle">{abierto === a.id ? '−' : '+'}</span>
              </button>
              {abierto === a.id && (
                <div className="ayuda-articulo-body">
                  {a.contenido.split('\n').map((linea, i) => (
                    linea.trim() ? <p key={i}>{linea}</p> : null
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className="ayuda-footer">
        <p>¿No encuentras lo que buscas? <Link href="/entrar">Inicia sesion</Link> y usa el asistente de inventario.</p>
        <p className="muted">inventserOnline · Sistema de inventarios en la nube</p>
      </footer>
    </main>
    <Footer />
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function Precios() {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/planes')
      .then((r) => r.json())
      .then((j) => setPlanes(j.planes || []))
      .catch(() => setPlanes([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <>
    <main className="precios">
      <header className="precios-header">
        <h1>Planes y precios</h1>
        <p className="sub">Elige el plan que mejor se adapta a tu negocio. Puedes cambiar de plan en cualquier momento.</p>
      </header>

      {cargando && <div className="cargando">Cargando planes...</div>}

      <div className="precios-grid">
        {planes.map((p) => (
          <div key={p.codigo} className={`plan-card ${p.destacado ? 'destacado' : ''}`}>
            {p.destacado && <div className="plan-badge">Recomendado</div>}
            <h2>{p.nombre}</h2>
            <p className="plan-desc">{p.descripcion}</p>
            <div className="plan-precio">
              {p.precio.mensual === 0 ? (
                <span className="precio-gratis">Gratis</span>
              ) : (
                <>
                  <span className="precio-monto">${p.precio.mensual}</span>
                  <span className="precio-periodo">/mes</span>
                </>
              )}
            </div>
            {p.precio.mensual > 0 && (
              <div className="plan-anual">o ${p.precio.anual} USD/ano (ahorra 2 meses)</div>
            )}
            <ul className="plan-features">
              {p.features.map((f, i) => (
                <li key={i}>&#10003; {f}</li>
              ))}
            </ul>
            <Link
              href={p.codigo === 'free' ? '/registro' : `/registro?plan=${p.codigo}`}
              className={`btn ${p.destacado ? 'btn-primary' : 'btn-secundario'}`}
            >
              {p.codigo === 'free' ? 'Comenzar gratis' : 'Elegir plan'}
            </Link>
          </div>
        ))}
      </div>

      <section className="precios-faq">
        <h2>Preguntas frecuentes</h2>
        <div className="faq-item">
          <h3>Puedo cambiar de plan en cualquier momento?</h3>
          <p>Si. Puedes subir o bajar de plan desde la seccion de Suscripcion en Configuracion. El cambio se aplica de inmediato.</p>
        </div>
        <div className="faq-item">
          <h3>Que pasa cuando vence la prueba gratuita?</h3>
          <p>Al vencer los 14 dias de prueba, el sistema te invita a elegir un plan. Mientras no elijas, puedes seguir viendo tus datos pero no crear nuevos registros.</p>
        </div>
        <div className="faq-item">
          <h3>Los datos se pierden si bajo de plan?</h3>
          <p>No. Tus datos se conservan. Solo se aplican los limites del nuevo plan para crear nuevos registros.</p>
        </div>
        <div className="faq-item">
          <h3>Que metodos de pago aceptan?</h3>
          <p>Stripe, Mercado Pago, PayPal y transferencia bancaria. Elige el que prefieras en el panel de pago.</p>
        </div>
      </section>
    </main>
    <Footer />
    </>
  );
}

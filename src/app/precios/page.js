'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { t, tl } from '@/lib/i18n';

export default function Precios() {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [lang, setLang] = useState('es');

  useEffect(() => {
    try { const m = document.cookie.match(/inventser_lang=([^;]+)/); setLang(m ? m[1] : 'es'); } catch { setLang('es'); }
    fetch('/api/planes')
      .then((r) => r.json())
      .then((j) => setPlanes(j.planes || []))
      .catch(() => setPlanes([]))
      .finally(() => setCargando(false));
  }, []);

  const tl = (k) => t(k, lang);

  return (
    <>
    <main className="precios">
      <header className="precios-header">
        <h1>{tl('precios_title')}</h1>
        <p className="sub">{lang === 'es' ? 'Elige el plan que mejor se adapta a tu negocio. Puedes cambiar de plan en cualquier momento.' : 'Choose the plan that best fits your business. You can change plans at any time.'}</p>
      </header>

      {cargando && <div className="cargando">{tl('cargando')}</div>}

      <div className="precios-grid">
        {planes.map((p) => (
          <div key={p.codigo} className={`plan-card ${p.destacado ? 'destacado' : ''}`}>
            {p.destacado && <div className="plan-badge">{lang === 'es' ? 'Recomendado' : 'Recommended'}</div>}
            <h2>{p.nombre}</h2>
            <p className="plan-desc">{p.descripcion}</p>
            <div className="plan-precio">
              {p.precio.mensual === 0 ? (
                <span className="precio-gratis">{tl('precio_gratis')}</span>
              ) : (
                <>
                  <span className="precio-monto">${p.precio.mensual}</span>
                  <span className="precio-periodo">{tl('precio_mensual')}</span>
                </>
              )}
            </div>
            {p.precio.mensual > 0 && (
              <div className="plan-anual">{lang === 'es' ? `o $${p.precio.anual} USD/año (ahorra 2 meses)` : `or $${p.precio.anual} USD/year (save 2 months)`}</div>
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
              {p.codigo === 'free' ? (lang === 'es' ? 'Comenzar gratis' : 'Start free') : (lang === 'es' ? 'Elegir plan' : 'Choose plan')}
            </Link>
          </div>
        ))}
      </div>

      <section className="precios-faq">
        <h2>{lang === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions'}</h2>
        <div className="faq-item">
          <h3>{lang === 'es' ? '¿Puedo cambiar de plan en cualquier momento?' : 'Can I change plans at any time?'}</h3>
          <p>{lang === 'es' ? 'Sí. Puedes subir o bajar de plan desde la sección de Suscripción en Configuración. El cambio se aplica de inmediato.' : 'Yes. You can upgrade or downgrade from the Subscription section in Settings. The change applies immediately.'}</p>
        </div>
        <div className="faq-item">
          <h3>{lang === 'es' ? '¿Qué pasa cuando vence la prueba gratuita?' : 'What happens when the free trial expires?'}</h3>
          <p>{lang === 'es' ? 'Al vencer los 14 días de prueba, el sistema te invita a elegir un plan. Mientras no elijas, puedes seguir viendo tus datos pero no crear nuevos registros.' : 'When the 14-day trial expires, the system invites you to choose a plan. Until you choose, you can keep viewing your data but not create new records.'}</p>
        </div>
        <div className="faq-item">
          <h3>{lang === 'es' ? '¿Los datos se pierden si bajo de plan?' : 'Do I lose data if I downgrade?'}</h3>
          <p>{lang === 'es' ? 'No. Tus datos se conservan. Solo se aplican los límites del nuevo plan para crear nuevos registros.' : 'No. Your data is preserved. Only the new plan limits apply for creating new records.'}</p>
        </div>
        <div className="faq-item">
          <h3>{lang === 'es' ? '¿Qué métodos de pago aceptan?' : 'What payment methods do you accept?'}</h3>
          <p>{lang === 'es' ? 'Stripe, Mercado Pago, PayPal y transferencia bancaria. Elige el que prefieras en el panel de pago.' : 'Stripe, Mercado Pago, PayPal and bank transfer. Choose your preferred method at checkout.'}</p>
        </div>
      </section>
    </main>
    <Footer lang={lang} />
    </>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PAISES, opcionesMoneda, monedaDePais, PAIS_POR_DEFECTO } from '@/lib/monedas';

const MONEDAS = opcionesMoneda();

function atribucion() {
  try { return JSON.parse(localStorage.getItem('inv_atribucion') || 'null') || {}; } catch { return {}; }
}

function FormularioRegistro() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const embed = searchParams.get('embed') === '1';
  const [giros, setGiros] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState({
    empresa: '', nombre: '', email: '', password: '', giro: '', rif: '', clave_admin: '',
    pais: PAIS_POR_DEFECTO, moneda: monedaDePais(PAIS_POR_DEFECTO),
  });
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch('/api/giros')
      .then((r) => r.json())
      .then((j) => {
        const lista = j.giros || [];
        setGiros(lista);
        if (lista.length) setForm((f) => ({ ...f, giro: lista[0].nombre }));
      })
      .catch(() => setGiros([]));
  }, []);

  // Al cambiar de giro, cargamos su descripcion y los campos que pedira
  useEffect(() => {
    if (!form.giro) return;
    let vivo = true;
    setDetalle(null);
    fetch('/api/giros/' + encodeURIComponent(form.giro) + '/campos')
      .then((r) => r.json())
      .then((j) => { if (vivo && j.ok) setDetalle(j); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [form.giro]);

  function cambiar(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  // Al elegir pais se propone su moneda; el usuario puede cambiarla.
  function cambiarPais(e) {
    const pais = e.target.value;
    setForm((f) => ({ ...f, pais, moneda: monedaDePais(pais) }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...atribucion() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo completar el registro');

      if (j.access_token) {
        localStorage.setItem('inventarios_sesion', JSON.stringify({
          access_token: j.access_token, refresh_token: j.refresh_token,
        }));
        document.cookie = `invetser_token=${j.access_token}; path=/; max-age=31536000; SameSite=Lax`;
        if (embed) {
          try { (window.top || window).location.href = '/panel'; } catch { router.push('/panel'); }
        } else {
          router.push('/panel');
        }
      } else {
        router.push('/entrar?nuevo=1');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="pagina-form">
      <div className="tarjeta tarjeta-ancha">
        <Link href="/" className="auth-logo" aria-label="inventserOnline - inicio">
          <img src="/logo.png" alt="inventserOnline" className="auth-logo-img" />
        </Link>
        <h1>Crea tu cuenta</h1>
        <p className="sub">
          Elige a que se dedica tu negocio y el sistema se adapta. Sin instalar nada.
        </p>

        {error && <div className="mensaje error">{error}</div>}

        <form onSubmit={enviar}>
          <div className="campo">
            <label>Nombre de tu empresa o negocio *</label>
            <input
              name="empresa"
              value={form.empresa}
              onChange={cambiar}
              placeholder="Ferreteria El Centro"
              required
            />
            <div className="ayuda">Es el nombre que veras en el panel y en los reportes.</div>
          </div>

          <div className="campo">
            <label>RIF o identificador fiscal (opcional)</label>
            <input name="rif" value={form.rif} onChange={cambiar} placeholder="J-12345678-9" />
          </div>

          <div className="campo">
            <label>Pais *</label>
            <select name="pais" value={form.pais} onChange={cambiarPais} required>
              {PAISES.map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
              ))}
            </select>
            <div className="ayuda">Se usa para proponer la moneda de tu empresa.</div>
          </div>

          <div className="campo">
            <label>Tipo de moneda *</label>
            <select name="moneda" value={form.moneda} onChange={cambiar} required>
              {MONEDAS.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nombre} ({m.codigo} {m.simbolo})
                </option>
              ))}
            </select>
            <div className="ayuda">
              Se usara para mostrar los montos. Podras cambiarla luego en Configuracion.
            </div>
          </div>

          <div className="campo">
            <label>A que se dedica tu negocio *</label>
            <select name="giro" value={form.giro} onChange={cambiar} required>
              {giros.map((g) => (
                <option key={g.id} value={g.nombre}>{g.nombre}</option>
              ))}
            </select>
          </div>

          {/* Guia dinamica: que significa el giro elegido y que pediran los productos */}
          {detalle && (
            <div className="guia-giro">
              <div className="guia-titulo">{detalle.giro.nombre}</div>
              <p className="guia-texto">{detalle.giro.descripcion || 'Giro generico.'}</p>

              {detalle.campos.length > 0 ? (
                <>
                  <div className="guia-subtitulo">
                    Tus productos pediran estos campos adicionales:
                  </div>
                  <ul className="guia-campos">
                    {detalle.campos.map((c) => (
                      <li key={c.id}>
                        <strong>{c.nombre}</strong>
                        <span className="guia-tipo">{etiquetaTipo(c.tipo)}</span>
                        {c.obligatorio && <span className="guia-obligatorio">obligatorio</span>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="guia-subtitulo">
                  Este giro no tiene campos adicionales: los productos se registran con
                  codigo, nombre, stock, precios y categoria. Puedes agregar campos
                  despues desde Configuracion.
                </div>
              )}
            </div>
          )}

          <div className="campo">
            <label>Tu nombre *</label>
            <input name="nombre" value={form.nombre} onChange={cambiar} placeholder="Juan Perez" required />
            <div className="ayuda">Quedaras como administrador de esta empresa.</div>
          </div>

          <div className="campo">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={cambiar}
              placeholder="juan@empresa.com"
              required
            />
            <div className="ayuda">Con este email entraras al sistema.</div>
          </div>

          <div className="campo">
            <label>Contrasena *</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={cambiar}
              placeholder="Minimo 6 caracteres"
              required
            />
            <div className="ayuda">
              No hace falta confirmar el correo: la cuenta queda activa al crearla.
            </div>
          </div>

          <div className="campo">
            <button type="button" className="btn-enlace" onClick={() => setVerClave((v) => !v)}>
              {verClave ? '- Ocultar clave de administrador' : '+ Tengo una clave de administrador'}
            </button>
          </div>

          {verClave && (
            <div className="campo">
              <label>Clave de administrador</label>
              <input
                name="clave_admin"
                value={form.clave_admin}
                onChange={cambiar}
                placeholder="ADM-XXXX-XXXX-XXXX"
              />
              <div className="ayuda">Solo si te la proporciono el administrador del sistema.</div>
            </div>
          )}

          <button className="btn btn-bloque" disabled={cargando}>
            {cargando ? 'Creando cuenta...' : 'Crear cuenta y entrar'}
          </button>
        </form>

        {!embed && (
          <p className="pie">
            Ya tienes cuenta? <Link href="/entrar">Entrar</Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default function Registro() {
  return (
    <Suspense fallback={<div className="tarjeta"><h1>Crea tu cuenta</h1></div>}>
      <FormularioRegistro />
    </Suspense>
  );
}

function etiquetaTipo(tipo) {
  return {
    text: 'texto',
    number: 'numero',
    date: 'fecha',
    integer: 'si / no',
  }[tipo] || tipo;
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Diagnostico() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem('inventarios_sesion') || '{}');
    if (!s.access_token) {
      setError('No hay sesion guardada. Entra primero en /entrar.');
      setCargando(false);
      return;
    }
    fetch('/api/diagnostico', { headers: { Authorization: 'Bearer ' + s.access_token } })
      .then((r) => r.json())
      .then((j) => (j.ok ? setDatos(j.diagnostico) : setError(j.error || 'Error')))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  function fila(etiqueta, valor, ok) {
    return (
      <tr>
        <td>{etiqueta}</td>
        <td className="mono">{String(valor)}</td>
        <td><span className={`estado ${ok ? 'verde' : 'rojo'}`}>{ok ? 'OK' : 'FALLA'}</span></td>
      </tr>
    );
  }

  return (
    <main className="admin">
      <div className="tarjeta" style={{ maxWidth: 760 }}>
        <h1>Diagnostico de sesion</h1>
        <p className="sub">Muestra exactamente que ve el servidor y la base de datos.</p>
        <p><Link href="/panel">Volver al sistema</Link></p>

        {cargando && <p>Consultando...</p>}
        {error && <div className="mensaje error">{error}</div>}

        {datos && (
          <>
            <h3>1. Sesion</h3>
            <table className="tabla-admin">
              <tbody>
                {fila('Token valido', datos.sesion.token_valido, datos.sesion.token_valido)}
                {fila('Usuario (auth)', datos.sesion.usuario_id, !!datos.sesion.usuario_id)}
                {fila('Email', datos.sesion.email, !!datos.sesion.email)}
              </tbody>
            </table>

            <h3>2. Lo que ve Postgres</h3>
            {datos.base.error ? (
              <div className="mensaje error">
                {datos.base.error}. {datos.base.nota || 'Ejecuta sql/007_diagnostico.sql'}
              </div>
            ) : (
              <table className="tabla-admin">
                <tbody>
                  {fila('auth.uid()', datos.base.auth_uid || 'NULL', !!datos.base.auth_uid)}
                  {fila('empresa_actual()', datos.base.empresa_actual || 'NULL', !!datos.base.empresa_actual)}
                  {fila('rol del JWT', datos.base.rol_jwt || 'NULL', !!datos.base.rol_jwt)}
                  {fila('RLS activo en perfiles', datos.base.usando_rls, true)}
                  {fila('policies en perfiles', (datos.base.policies_perfiles || []).join(', '), (datos.base.policies_perfiles || []).length > 0)}
                </tbody>
              </table>
            )}

            <h3>3. Lectura con el token del usuario</h3>
            <table className="tabla-admin">
              <tbody>
                {fila('Perfil legible', datos.conToken.perfil_legible, datos.conToken.perfil_legible)}
                {datos.conToken.error && fila('Error', datos.conToken.error, false)}
              </tbody>
            </table>

            <h3>4. Verdad absoluta (service_role)</h3>
            <table className="tabla-admin">
              <tbody>
                {fila('Perfil existe', datos.conServiceRole.perfil_existe, datos.conServiceRole.perfil_existe)}
                {fila('Empresas en total', datos.conServiceRole.total_empresas, (datos.conServiceRole.total_empresas || 0) > 0)}
              </tbody>
            </table>

            <div className="mensaje ok" style={{ marginTop: 16 }}>
              Interpretacion: si <b>auth.uid()</b> es NULL, el token no llega a Postgres.
              Si trae tu id pero <b>Perfil legible</b> es FALLA, falta la policy.
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ============================================================
   /panel -> monta el sistema.
   El renderer es EXACTAMENTE el de la version de escritorio
   (public/renderer): mismo HTML, CSS y logica. La unica diferencia
   es js/api-web.js, que sustituye al puente de Electron y habla
   con la API de Next.js en lugar de con el proceso principal.

   Los parametros de vuelta de las pasarelas (?pago=ok&session_id=...)
   se pasan al iframe para que el renderer confirme el pago.
   ============================================================ */

export const metadata = {
  title: 'Panel - Sistema de Inventarios',
};

const CLAVES_PAGO = ['pago', 'session_id', 'payment_id', 'collection_status', 'status', 'external_reference'];

export default async function Panel({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = new URLSearchParams();
  for (const k of CLAVES_PAGO) {
    const v = sp[k];
    if (v !== undefined && v !== null && String(v) !== '') q.set(k, String(v));
  }
  const src = '/renderer/index.html' + (q.toString() ? '?' + q.toString() : '');
  return <iframe src={src} title="Sistema de Inventarios" style={estilo} />;
}

const estilo = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 'none',
  display: 'block',
};

/* ============================================================
   /panel -> monta el sistema.
   El renderer es EXACTAMENTE el de la version de escritorio
   (public/renderer): mismo HTML, CSS y logica. La unica diferencia
   es js/api-web.js, que sustituye al puente de Electron y habla
   con la API de Next.js en lugar de con el proceso principal.
   ============================================================ */

export const metadata = {
  title: 'Panel - Sistema de Inventarios',
};

export default function Panel() {
  return <iframe src="/renderer/index.html" title="Sistema de Inventarios" style={estilo} />;
}

const estilo = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 'none',
  display: 'block',
};

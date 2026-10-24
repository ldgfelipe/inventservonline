import FormularioBaja from './FormularioBaja';

export const metadata = {
  title: 'Darte de baja · inventserOnline',
  robots: { index: false, follow: false },
};

export default async function Baja({ searchParams }) {
  const sp = (await searchParams) || {};
  const email = String(sp.e || '').trim();
  const codigo = String(sp.c || '').trim();

  return (
    <main className="pagina-form">
      <FormularioBaja email={email} codigo={codigo} />
    </main>
  );
}

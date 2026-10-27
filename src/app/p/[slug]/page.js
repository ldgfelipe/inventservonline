import { notFound } from 'next/navigation';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTRO_IFRAME = `<iframe src="/registro?embed=1" style="width:100%;height:560px;border:0;display:block;" loading="lazy" title="Formulario de registro"></iframe>`;

export async function generateMetadata({ params }) {
  try {
    const { slug } = await params;
    const sb = admin();
    const { data } = await sb.from('paginas').select('titulo, publicado').eq('slug', slug).maybeSingle();
    if (!data || !data.publicado) return { title: 'Página no encontrada' };
    return { title: data.titulo + ' · inventserOnline' };
  } catch {
    return { title: 'inventserOnline' };
  }
}

export default async function PaginaPublica({ params }) {
  let data = null;
  try {
    const { slug } = await params;
    const sb = admin();
    const { data: d } = await sb.from('paginas').select('slug, titulo, html, publicado').eq('slug', slug).maybeSingle();
    data = d;
  } catch {
    data = null;
  }
  if (!data || !data.publicado) notFound();

  const html = String(data.html || '').replace(/\{\{REGISTRO\}\}/g, REGISTRO_IFRAME);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

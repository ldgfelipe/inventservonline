import { error, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/landing/[slug] -> landing page publica (sin auth) */
export async function GET(request, { params }) {
  const { slug } = await params;
  const sb = admin();
  const { data, error: err } = await sb.from('landing_pages').select('*').eq('slug', slug).eq('publicada', true).maybeSingle();
  if (err || !data) return Response.json({ ok: false, error: 'Landing no encontrada' }, { status: 404 });
  // Incrementar visitas
  await sb.from('landing_pages').update({ visitas: (data.visitas || 0) + 1 }).eq('id', data.id);
  // Obtener pixeles
  let pixeles = [];
  if (data.pixeles && data.pixeles.length) {
    const { data: px } = await sb.from('pixeles').select('plataforma, codigo, activo').in('id', data.pixeles).eq('activo', true);
    pixeles = px || [];
  }
  // Pixeles globales
  const { data: globales } = await sb.from('pixeles').select('plataforma, codigo, activo').eq('global', true).eq('activo', true);
  pixeles = [...(globales || []), ...pixeles];
  return Response.json({ ok: true, landing: data, pixeles });
}

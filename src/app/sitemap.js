import { admin } from '@/lib/supabase';

const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventser.online').replace(/\/+$/, '');

export default async function sitemap() {
  const urls = [
    { url: '/', changeFrequency: 'weekly', priority: 1 },
    { url: '/precios', changeFrequency: 'monthly', priority: 0.9 },
    { url: '/ayuda', changeFrequency: 'weekly', priority: 0.8 },
    { url: '/registro', changeFrequency: 'monthly', priority: 0.8 },
    { url: '/mapa-del-sitio', changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    const sb = admin();
    const { data } = await sb.from('paginas')
      .select('slug, updated_at')
      .eq('publicado', true)
      .order('updated_at', { ascending: false });
    for (const p of data || []) {
      urls.push({
        url: '/p/' + p.slug,
        lastModified: p.updated_at || undefined,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch { /* sin migracion 036 o sin env: solo las rutas fijas */ }

  return urls.map((u) => ({
    ...u,
    url: BASE + u.url,
  }));
}

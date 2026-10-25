const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventservonline.vercel.app').replace(/\/+$/, '');

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/panel', '/api/', '/entrar'],
      },
      // Rastreadores de IA: se permite el contenido publico para que
      // puedan indexar y citar la informacion del sitio.
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
      { userAgent: 'Bytespider', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
    ],
    sitemap: BASE + '/sitemap.xml',
    host: BASE,
  };
}

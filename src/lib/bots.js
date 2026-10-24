/* Deteccion de validadores de correo, crawlers y prefetch.
   Se usa en el pixel y en el enlace de seguimiento para no contar
   aperturas/clicks que no son de una persona. */

const UA_BOT = /(proofpoint|mimecast|barracuda|symantec|sophos|ironport|forcepoint|trendmicro|trend micro|fireeye|messagelabs|cloudmark|spamassassin|spam|x-validator|validator|scanner|security|curl\/|wget\/|python-|python\/|go-http|java\/|libwww|axios\/|node-fetch|headless|phantomjs|selenium|puppeteer|playwright|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|slurp|facebookexternalhit|linkedinbot|twitterbot|telegrambot|discordbot|slackbot|skypeuripreview|applebot|petalbot|semrushbot|ahrefsbot|mj12bot|dotbot)/i;

const UA_PROXY_IMG = /(googleimageproxy|yahoomailproxy)/i;

export function esBot(userAgent = '') {
  const ua = String(userAgent || '');
  if (!ua) return true;
  if (UA_BOT.test(ua)) return true;
  // Proxies de imagenes de Gmail/Yahoo: no son el usuario, pero suelen
  // indicar que el correo se mostro. Se dejan pasar como apertura real.
  if (UA_PROXY_IMG.test(ua)) return false;
  return false;
}

export function esPrefetch(headers) {
  try {
    const propositos = [
      headers.get('sec-purpose'),
      headers.get('purpose'),
      headers.get('x-purpose'),
      headers.get('x-moz'),
    ].filter(Boolean).join(' ').toLowerCase();
    return /prefetch|preview|prerender/.test(propositos);
  } catch {
    return false;
  }
}

/* Motivo por el que se considera bot (para guardarlo en la BD). */
export function motivoBot(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!ua) return 'sin-user-agent';
  if (UA_BOT.test(ua)) return 'user-agent-bot';
  if (esPrefetch(request.headers)) return 'prefetch';
  return null;
}

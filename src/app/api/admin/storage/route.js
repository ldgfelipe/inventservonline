import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';
import { listarTodosArchivos, borrarArchivo } from '@/lib/storage';

export const runtime = 'nodejs';

/* GET /api/admin/storage -> ranking por empresa + archivos huerfanos */
async function analizar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const sb = admin();
  const [{ data: empresas }, { data: adjuntos }, { data: conLogo }] = await Promise.all([
    sb.from('empresas').select('id, nombre, email'),
    sb.from('producto_adjuntos').select('ruta'),
    sb.from('empresas').select('logo_path').not('logo_path', 'is', null),
  ]);

  const nombrePorId = {};
  for (const e of empresas || []) nombrePorId[e.id] = e.nombre;

  // Conjunto de rutas conocidas (adjuntos + logos)
  const conocidas = new Set();
  for (const a of adjuntos || []) if (a.ruta) conocidas.add(a.ruta);
  for (const e of conLogo || []) if (e.logo_path) conocidas.add(e.logo_path);

  let archivos = [];
  try { archivos = await listarTodosArchivos(); } catch { archivos = []; }

  const porEmpresa = {};
  const huerfanos = [];

  for (const f of archivos) {
    // Ruta esperada: empresas/{empresaId}/...
    const partes = String(f.ruta).split('/');
    const empresaId = partes[1] || 'desconocida';
    if (!porEmpresa[empresaId]) porEmpresa[empresaId] = { bytes: 0, archivos: 0 };
    porEmpresa[empresaId].bytes += f.bytes;
    porEmpresa[empresaId].archivos += 1;

    // Huerfano: no esta en la BD y no es un comprobante (se conservan)
    const esComprobante = partes[2] === 'comprobantes';
    if (!conocidas.has(f.ruta) && !esComprobante) {
      huerfanos.push({ ruta: f.ruta, bytes: f.bytes });
    }
  }

  const ranking = Object.entries(porEmpresa)
    .map(([id, v]) => ({
      empresa_id: id,
      empresa: nombrePorId[id] || (id === 'desconocida' ? 'Sin empresa' : id.slice(0, 8) + '...'),
      bytes: v.bytes,
      mb: Math.round((v.bytes / 1024 / 1024) * 100) / 100,
      archivos: v.archivos,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const totalBytes = archivos.reduce((a, f) => a + f.bytes, 0);

  return Response.json({
    ok: true,
    ranking,
    huerfanos,
    huerfanos_bytes: huerfanos.reduce((a, f) => a + f.bytes, 0),
    total_bytes: totalBytes,
    total_mb: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
    total_archivos: archivos.length,
  });
}

/* POST /api/admin/storage { accion: 'limpiar_huerfanos', rutas: [...] } */
async function limpiar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  if (cuerpo.accion !== 'limpiar_huerfanos') return error('Accion invalida');
  const rutas = Array.isArray(cuerpo.rutas) ? cuerpo.rutas : [];
  if (!rutas.length) return error('No hay rutas para eliminar');

  // Verificar que sean huerfanos reales (seguridad: no borrar archivos en uso)
  const sb = admin();
  const [{ data: adjuntos }, { data: conLogo }] = await Promise.all([
    sb.from('producto_adjuntos').select('ruta'),
    sb.from('empresas').select('logo_path').not('logo_path', 'is', null),
  ]);
  const conocidas = new Set();
  for (const a of adjuntos || []) if (a.ruta) conocidas.add(a.ruta);
  for (const e of conLogo || []) if (e.logo_path) conocidas.add(e.logo_path);

  let eliminados = 0;
  const omitidos = [];
  for (const ruta of rutas) {
    const esComprobante = String(ruta).split('/')[2] === 'comprobantes';
    if (conocidas.has(ruta) || esComprobante) { omitidos.push(ruta); continue; }
    try {
      await borrarArchivo(ruta);
      eliminados++;
    } catch { omitidos.push(ruta); }
  }

  return Response.json({ ok: true, eliminados, omitidos });
}

export const GET = manejar(analizar);
export const POST = manejar(limpiar);

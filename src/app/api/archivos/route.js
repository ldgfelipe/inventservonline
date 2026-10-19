import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { subirArchivo, urlFirmada, borrarArchivo, usoStorage } from '@/lib/storage';

export const runtime = 'nodejs';

/* POST /api/archivos/subir
   Body: FormData con 'archivo' (File) y 'carpeta' (string: comprobantes, logos, adjuntos).
   Devuelve { ruta, url }. */
async function subir(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');

  const form = await request.formData();
  const archivo = form.get('archivo');
  const carpeta = String(form.get('carpeta') || 'adjuntos').replace(/[^a-z0-9_-]/gi, '');
  if (!archivo || typeof archivo === 'string') return error('Falta el archivo');

  // Verificar limite de almacenamiento del plan
  try {
    const { leerSuscripcion } = await import('@/lib/licenciamiento');
    const { limiteDe } = await import('@/lib/planes');
    const { usoStorage } = await import('@/lib/storage');
    const sus = await leerSuscripcion(sb, perfil.empresa_id);
    const limiteMB = limiteDe(sus.plan, 'almacenamiento_mb');
    if (limiteMB !== null) {
      const bytesUsados = await usoStorage(perfil.empresa_id);
      const mbUsados = bytesUsados / 1024 / 1024;
      const mbArchivo = archivo.size / 1024 / 1024;
      if (mbUsados + mbArchivo > limiteMB) {
        return error(`Alcanzaste el limite de almacenamiento de tu plan (${mbUsados.toFixed(1)}/${limiteMB} MB). Sube de plan para mas espacio.`, 403);
      }
    }
  } catch { /* si falla la verificacion, se permite la subida */ }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const nombre = String(archivo.name || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ruta = `empresas/${perfil.empresa_id}/${carpeta}/${Date.now()}_${nombre}`;

  try {
    const path = await subirArchivo(ruta, buffer, archivo.type);
    const url = await urlFirmada(path, 3600);
    await auditar(sb, perfil, { accion: 'archivo.subir', entidad: 'archivo', entidadId: path, detalle: `${archivo.name} (${archivo.size} bytes)` });
    return Response.json({ ok: true, ruta: path, url }, { status: 201 });
  } catch (err) {
    return error('No se pudo subir el archivo: ' + err.message, 500);
  }
}

/* GET /api/archivos/url?ruta=... -> URL firmada temporal */
async function url(request) {
  const { perfil, sb } = await sesion(request);
  const ruta = new URL(request.url).searchParams.get('ruta');
  if (!ruta) return error('Falta la ruta');
  // Verificar que la ruta pertenece a la empresa
  if (!ruta.startsWith(`empresas/${perfil.empresa_id}/`)) return error('Sin acceso', 403);
  try {
    const url = await urlFirmada(ruta, 3600);
    return Response.json({ ok: true, url });
  } catch (err) {
    return error('No se pudo generar la URL: ' + err.message, 500);
  }
}

/* GET /api/archivos/uso -> uso de storage de la empresa en bytes */
async function uso(request) {
  const { perfil, sb } = await sesion(request);
  try {
    const bytes = await usoStorage(perfil.empresa_id);
    return Response.json({ ok: true, bytes, mb: Math.round(bytes / 1024 / 1024 * 100) / 100 });
  } catch (err) {
    return error('No se pudo calcular el uso: ' + err.message, 500);
  }
}

export const GET = manejar(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.has('ruta')) return url(req);
  return uso(req);
});
export const POST = manejar(subir);

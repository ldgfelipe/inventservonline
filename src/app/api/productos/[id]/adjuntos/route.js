import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { subirArchivo, urlFirmada, borrarArchivo } from '@/lib/storage';

export const runtime = 'nodejs';

/* GET /api/productos/[id]/adjuntos -> adjuntos del producto */
async function listar(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.ver');
  const id = params.id;
  const { data, error: err } = await sb.from('producto_adjuntos')
    .select('*').eq('empresa_id', perfil.empresa_id).eq('producto_id', id).order('created_at', { ascending: false });
  if (err) {
    if (/producto_adjuntos|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, adjuntos: [] });
    return error(err.message, 500);
  }
  // Generar URLs firmadas
  const adjuntos = [];
  for (const a of data || []) {
    try {
      const url = await urlFirmada(a.ruta, 3600);
      adjuntos.push({ ...a, url });
    } catch {
      adjuntos.push({ ...a, url: null });
    }
  }
  return Response.json({ ok: true, adjuntos });
}

/* POST /api/productos/[id]/adjuntos -> subir adjunto */
async function subir(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.editar');
  const id = params.id;
  const form = await request.formData();
  const archivo = form.get('archivo');
  if (!archivo || typeof archivo === 'string') return error('Falta el archivo');

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const nombre = String(archivo.name || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ruta = `empresas/${perfil.empresa_id}/adjuntos/${id}/${Date.now()}_${nombre}`;

  try {
    const path = await subirArchivo(ruta, buffer, archivo.type);
    const { data, error: err } = await sb.from('producto_adjuntos').insert({
      empresa_id: perfil.empresa_id,
      producto_id: id,
      ruta: path,
      nombre: archivo.name,
      tipo: archivo.type,
      tamano: archivo.size,
    }).select('id').single();
    if (err) return error('No se pudo registrar: ' + err.message, 500);
    await auditar(sb, perfil, { accion: 'adjunto.subir', entidad: 'producto', entidadId: id, detalle: archivo.name });
    return Response.json({ ok: true, id: data.id, ruta: path }, { status: 201 });
  } catch (err) {
    return error('No se pudo subir: ' + err.message, 500);
  }
}

/* DELETE /api/productos/[id]/adjuntos?adjunto_id=... */
async function eliminar(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.editar');
  const id = params.id;
  const adjuntoId = new URL(request.url).searchParams.get('adjunto_id');
  if (!adjuntoId) return error('Falta adjunto_id');

  const { data: adj } = await sb.from('producto_adjuntos').select('ruta').eq('empresa_id', perfil.empresa_id).eq('id', adjuntoId).maybeSingle();
  if (!adj) return error('Adjunto no encontrado', 404);

  try {
    await borrarArchivo(adj.ruta);
  } catch { /* ignore */ }
  await sb.from('producto_adjuntos').delete().eq('empresa_id', perfil.empresa_id).eq('id', adjuntoId);
  await auditar(sb, perfil, { accion: 'adjunto.eliminar', entidad: 'producto', entidadId: id, detalle: adjuntoId });
  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(subir);
export const DELETE = manejar(eliminar);

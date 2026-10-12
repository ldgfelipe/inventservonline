import { error, sesion, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/asistente/alias -> alias aprendidos por el usuario */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  const { data } = await sb.from('asistente_alias')
    .select('id, frase, productos(nombre)')
    .eq('empresa_id', perfil.empresa_id).eq('usuario_id', perfil.id)
    .order('usado', { ascending: false, nullsFirst: false }).limit(50);

  return Response.json({
    ok: true,
    alias: (data || []).map((a) => ({
      id: a.id, frase: a.frase, producto_nombre: a.productos ? a.productos.nombre : null,
    })),
  });
}

/* POST /api/asistente/aprender  { frase, producto_id } */
async function aprender(request) {
  const { perfil, sb } = await sesion(request);
  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const frase = String(cuerpo.frase || '').trim();
  if (!frase) return error('Escribe como llamas al producto');
  if (!cuerpo.producto_id) return error('Falta el producto');

  await sb.from('asistente_alias').upsert({
    empresa_id: perfil.empresa_id, usuario_id: perfil.id, frase,
    producto_id: cuerpo.producto_id,
  }, { onConflict: 'empresa_id,usuario_id,frase' });

  await auditar(sb, perfil, { accion: 'asistente.alias', entidad: 'asistente', entidadId: cuerpo.producto_id, detalle: 'Alias: ' + frase });
  return Response.json({ ok: true });
}

/* DELETE /api/asistente/alias?id= */
async function borrar(request) {
  const { perfil, sb } = await sesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error('Falta el id');
  await sb.from('asistente_alias').delete().eq('empresa_id', perfil.empresa_id).eq('id', id);
  return Response.json({ ok: true });
}

export const GET = manejar(listar);
export const POST = manejar(aprender);
export const DELETE = manejar(borrar);

import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/giros/[nombre]/campos -> campos personalizados de un giro */
async function campos(request, { params }) {
  const { sb } = await sesion(request);
  const { nombre } = await params;

  const { data: giro } = await sb.from('giros').select('id, nombre').eq('nombre', nombre).maybeSingle();
  if (!giro) return Response.json({ ok: true, campos: [] });

  const { data, error: err } = await sb.from('campos_giro')
    .select('*').eq('giro_id', giro.id).order('id');
  if (err) return error(err.message, 500);

  return Response.json({ ok: true, campos: data || [] });
}

export const GET = manejar(campos);

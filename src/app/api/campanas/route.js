import { error, sesion, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/campanas -> lista de campanas */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  const { data, error: err } = await sb.from('campanas').select('*').order('created_at', { ascending: false }).limit(100);
  if (err) {
    if (/campanas|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, campanas: [] });
    return error(err.message, 500);
  }
  return Response.json({ ok: true, campanas: data || [] });
}

/* POST /api/campanas { nombre, tipo, canal, descripcion, presupuesto, fecha_inicio, fecha_fin, utm_*, landing_url, pixel_id } */
async function crear(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const nombre = String(cuerpo.nombre || '').trim();
  if (!nombre) return error('El nombre es obligatorio');
  const { data, error: err } = await sb.from('campanas').insert({
    nombre,
    tipo: cuerpo.tipo || 'ccp',
    canal: cuerpo.canal || null,
    descripcion: cuerpo.descripcion || null,
    presupuesto: Number(cuerpo.presupuesto) || 0,
    moneda: cuerpo.moneda || 'USD',
    fecha_inicio: cuerpo.fecha_inicio || null,
    fecha_fin: cuerpo.fecha_fin || null,
    estado: cuerpo.estado || 'borrador',
    utm_source: cuerpo.utm_source || null,
    utm_medium: cuerpo.utm_medium || null,
    utm_campaign: cuerpo.utm_campaign || null,
    utm_content: cuerpo.utm_content || null,
    utm_term: cuerpo.utm_term || null,
    landing_url: cuerpo.landing_url || null,
    pixel_id: cuerpo.pixel_id || null,
    created_by: perfil.id,
  }).select('id').single();
  if (err) return error('No se pudo crear: ' + err.message, 500);
  return Response.json({ ok: true, id: data.id }, { status: 201 });
}

export const GET = manejar(listar);
export const POST = manejar(crear);

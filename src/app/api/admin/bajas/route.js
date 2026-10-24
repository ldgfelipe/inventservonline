import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/admin/bajas?campana_id= -> listado de correos dados de baja */
async function listar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const { searchParams } = new URL(request.url);
  const campanaId = searchParams.get('campana_id');

  const sb = admin();
  let q = sb.from('email_bajas').select('*').order('created_at', { ascending: false }).limit(5000);
  if (campanaId) q = q.eq('campana_id', campanaId);

  const { data, error: err } = await q;
  if (err) {
    if (/email_bajas|does not exist|schema cache/i.test(err.message)) {
      return Response.json({ ok: true, bajas: [], aviso: 'Falta aplicar la migracion 040 (bajas).' });
    }
    return error(err.message, 500);
  }

  const { data: campanas } = await sb.from('campanas').select('id, nombre');
  const nombres = {};
  for (const c of campanas || []) nombres[c.id] = c.nombre;

  return Response.json({
    ok: true,
    bajas: (data || []).map((b) => ({
      id: b.id,
      email: b.email,
      campana_id: b.campana_id,
      campana: b.campana_id ? (nombres[b.campana_id] || '-') : '-',
      motivo: b.motivo,
      created_at: b.created_at,
    })),
  });
}

export const GET = manejar(listar);

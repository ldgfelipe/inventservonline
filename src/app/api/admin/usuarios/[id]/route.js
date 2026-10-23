import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';
import { usoStorage } from '@/lib/storage';

export const runtime = 'nodejs';

/* GET /api/admin/usuarios/[id] -> detalle del usuario y su empresa */
async function detalle(request, { params }) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);

  const { id } = await params;
  const sb = admin();

  const { data: p, error: err } = await sb.from('perfiles')
    .select('id, nombre, empresa_id, rol, area, activo, super_admin, created_at')
    .eq('id', id).maybeSingle();
  if (err) return error(err.message, 500);
  if (!p) return error('Usuario no encontrado', 404);

  const { data: empresa } = await sb.from('empresas')
    .select('id, nombre, email, giro_actual, plan, pais, moneda, created_at').eq('id', p.empresa_id).maybeSingle();

  let email = null;
  try {
    const { data: u } = await sb.auth.admin.getUserById(id);
    email = u && u.user ? u.user.email : null;
  } catch { /* opcional */ }

  // Conteos de uso de la empresa
  const [{ count: productos }, { count: movimientos }, { count: ventas }, { count: usuarios }, { count: adjuntos }] = await Promise.all([
    sb.from('productos').select('id', { count: 'exact', head: true }).eq('empresa_id', p.empresa_id).eq('activo', true),
    sb.from('movimientos').select('id', { count: 'exact', head: true }).eq('empresa_id', p.empresa_id),
    sb.from('ventas').select('id', { count: 'exact', head: true }).eq('empresa_id', p.empresa_id),
    sb.from('perfiles').select('id', { count: 'exact', head: true }).eq('empresa_id', p.empresa_id),
    sb.from('producto_adjuntos').select('id', { count: 'exact', head: true }).eq('empresa_id', p.empresa_id),
  ]);

  // Espacio de storage
  let storageBytes = 0;
  try { storageBytes = await usoStorage(p.empresa_id); } catch { storageBytes = 0; }

  // Ultimos accesos / actividad del usuario en la bitacora
  const { data: actividad } = await sb.from('bitacora')
    .select('accion, entidad, detalle, fecha').eq('usuario_id', id)
    .order('fecha', { ascending: false }).limit(20);

  // Historial de bloqueos
  const { data: bloqueos } = await sb.from('usuarios_bloqueos')
    .select('accion, motivo, realizado_por_nombre, created_at').eq('usuario_id', id)
    .order('created_at', { ascending: false }).limit(20);

  return Response.json({
    ok: true,
    usuario: {
      id: p.id, nombre: p.nombre, email, rol: p.rol, area: p.area,
      activo: p.activo, super_admin: p.super_admin, created_at: p.created_at,
    },
    empresa: empresa || null,
    uso: {
      productos: productos || 0,
      movimientos: movimientos || 0,
      ventas: ventas || 0,
      usuarios: usuarios || 0,
      adjuntos: adjuntos || 0,
      storage_bytes: storageBytes,
      storage_mb: Math.round((storageBytes / 1024 / 1024) * 100) / 100,
    },
    actividad: actividad || [],
    bloqueos: bloqueos || [],
  });
}

export const GET = manejar(detalle);

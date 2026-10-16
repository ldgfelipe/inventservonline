import { admin } from '@/lib/supabase';
import { error } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/giros/[nombre]/campos -> campos personalizados de un giro.
   Es informacion del catalogo compartido, no de la empresa: por eso
   se puede consultar SIN sesion, que es lo que necesita la pagina de
   registro para explicar que va a pedir el sistema. */
async function campos(request, { params }) {
  const { nombre } = await params;
  // Catalogo compartido y publico (la pagina de registro lo consulta sin
  // sesion). Las policies de RLS son "to authenticated", por lo que con la
  // clave anonima la busqueda del giro fallaba: se lee con service_role.
  const sb = admin();

  // descripcion viene de la migracion 008; si la base no la tiene
  // todavia, seguimos sin ella en lugar de fallar con 500.
  let { data: giro, error: errGiro } = await sb.from('giros')
    .select('id, nombre, descripcion').eq('nombre', nombre).maybeSingle();
  if (errGiro) {
    ({ data: giro, error: errGiro } = await sb.from('giros')
      .select('id, nombre').eq('nombre', nombre).maybeSingle());
  }
  if (errGiro) return error(errGiro.message, 500);
  if (!giro) return error('Giro no encontrado', 404);
  if (giro.descripcion === undefined) giro.descripcion = null;

  const { data, error: err } = await sb.from('campos_giro')
    .select('id, nombre, tipo, obligatorio').eq('giro_id', giro.id).order('id');
  if (err) return error(err.message, 500);

  return Response.json({
    ok: true,
    giro,
    campos: (data || []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      obligatorio: c.obligatorio,
    })),
  });
}

export const GET = campos;

import { error, sesion, exigir, manejar } from '@/lib/auth';
import { mapaPerfiles } from '@/lib/perfiles';

export const runtime = 'nodejs';

/* GET /api/trazabilidad?id=<producto>
  Historial completo: datos, campos del giro, movimientos con responsable
   y eventos administrativos. Es la vista que responde "quien hizo que". */
async function producto(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'trazabilidad.ver');

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error('Falta el producto');

  const { data: prod, error: err } = await sb.from('productos')
    .select('*').eq('empresa_id', perfil.empresa_id).eq('id', id).maybeSingle();
  if (err) return error(err.message, 500);
  if (!prod) return error('Producto no encontrado', 404);

  const [movimientos, eventos, valores, empresa] = await Promise.all([
    sb.from('movimientos')
      .select('*')
      .eq('empresa_id', perfil.empresa_id).eq('producto_id', id)
      .order('fecha', { ascending: true }),
    sb.from('bitacora').select('*')
      .eq('empresa_id', perfil.empresa_id).eq('entidad', 'producto').eq('entidad_id', id)
      .order('fecha', { ascending: true }),
    sb.from('valores_campos')
      .select('campo_id, valor').eq('empresa_id', perfil.empresa_id).eq('producto_id', id),
    sb.from('empresas').select('giro_actual').eq('id', perfil.empresa_id).maybeSingle(),
  ]);

  // movimientos.usuario_id no tiene FK a perfiles: no se puede embeber.
  const responsables = await mapaPerfiles(sb, (movimientos.data || []).map((m) => m.usuario_id));

  // Campos del giro activo de la empresa
  let camposGiro = [];
  if (empresa.data && empresa.data.giro_actual) {
    const { data: giro } = await sb.from('giros').select('id')
      .eq('nombre', empresa.data.giro_actual).maybeSingle();
    if (giro) {
      const { data } = await sb.from('campos_giro').select('id, nombre').eq('giro_id', giro.id);
      camposGiro = data || [];
    }
  }

  return Response.json({
    ok: true,
    producto: prod,
    movimientos: (movimientos.data || []).map((m) => {
      const p = responsables[m.usuario_id];
      return {
        ...m,
        usuario_nombre: p ? p.nombre : null,
        usuario_area: p ? p.area : null,
        usuario_rol: p ? p.rol : null,
      };
    }),
    bitacora: eventos.data || [],
    camposGiro,
    valores: valores.data || [],
  });
}

export const GET = manejar(producto);

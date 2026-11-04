import { error, sesion, exigir } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/scan — guarda un código escaneado como producto / proveedor / almacén.
 *
 * Cuerpo:
 *   { owner_type: 'producto' | 'proveedor' | 'almacen',
 *     code: string,
 *     nombre: string (opcional),
 *     ubicacion: string (opcional),
 *     unidad: string (opcional) }
 *
 * Respuestas:
 *   201  { ok: true, id: ... }
 *   200  { ok: true, id: ..., duplicado: true }  ya existía
 *   409  código duplicado para productos
 *   400  campos obligatorios faltantes
 *   403  sin permiso
 *   500  error interno DB
 */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.crear');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const ownerType = String(cuerpo.owner_type || '');
  const code = String(cuerpo.code || '').trim();
  const nombre = String(cuerpo.nombre || '');
  const restUbicacion = String(cuerpo.ubicacion || '');
  const restUnidad = String(cuerpo.unidad || 'unidad');

  // ---- PRODUCTO ----
  if (ownerType === 'producto') {
    if (!nombre && !restUbicacion) return error('El nombre o ubicación es obligatorio');

    // Verificar duplicado por código
    if (code) {
      const existente = await sb
        .from('productos')
        .select('id', 'codigo')
        .eq('empresa_id', perfil.empresa_id)
        .maybeSingle();

      if (existente && existente.codigo && String(existente.codigo).trim() === code) {
        return Response.json({ ok: false, error: 'Este código ya está registrado', duplicado: true }, { status: 409 });
      }
    }

    const data = {
      empresa_id: perfil.empresa_id,
      codigo: code || null,
      nombre: String(nombre).trim() || '(sin nombre)',
      proveedor_id: cuerpo.proveedor_id || null,
      ubicacion: restUbicacion || null,
      unidad: restUnidad,
      stock_minimo: Number(cuerpo.stock_minimo) || 0,
      stock_maximo: Number(cuerpo.stock_maximo) || 0,
      precio_compra: Number(cuerpo.precio_compra) || 0,
      precio_venta: Number(cuerpo.precio_venta) || 0,
      punto_reorden: Number(cuerpo.punto_reorden) || 0,
    };

    let { data: newId, error: err } = await sb
      .from('productos')
      .insert({ ...data })
      .select('id')
      .single();

    if (err && /column|punto_reorden|unidad|lote|fecha_vencimiento|costo_promedio|schema cache/i.test(String(err.message))) {
      ({ data: newId, error: err } = await sb.from('productos').insert({ ...data, stock_minimo: 0, stock_maximo: 0, precio_compra: 0, precio_venta: 0 }).select('id').single());
    }

    if (err) {
      if (err.code === '23505') return error('Ya existe un producto con ese código', 409);
      return error('No se pudo crear producto: ' + err.message, 500);
    }
    return Response.json({ ok: true, id: newId.data }, { status: 201 });
  }

  // ---- PROVEEDOR ----
  if (ownerType === 'proveedor') {
    const provNombre = String(nombre).trim() || '(sin nombre)';

    const existente = await sb
      .from('proveedores')
      .select('id', 'nombre')
      .eq('empresa_id', perfil.empresa_id)
      .eq('nombre', String(provNombre))
      .maybeSingle();

    if (existente && existente.id) {
      return Response.json({ ok: true, id: existente.id, duplicado: true }, { status: 200 });
    }

    let { data: provId, error: errProv } = await sb
      .from('proveedores')
      .insert({ empresa_id: perfil.empresa_id, nombre: String(provNombre) })
      .select('id')
      .single();

    if (errProv) {
      if (errProv.code === '23505') {
        const r = await sb
          .from('proveedores')
          .select('id')
          .eq('empresa_id', perfil.empresa_id)
          .eq('nombre', String(provNombre))
          .maybeSingle();
        return r ? r : { ok: false, error: 'Error creando proveedor' };
      }
      return error('No se pudo crear proveedor: ' + errProv.message, 500);
    }

    // Crear producto vinculado (scan de proveedor -> producto con nombre del proveedor)
    const prodId = await sb
      .from('productos')
      .insert({
        empresa_id: perfil.empresa_id,
        codigo: code || null,
        nombre: String(provNombre) + ' (proveedor)',
        proveedor_id: provId.data,
      })
      .select('id')
      .single();

    return Response.json({ ok: true, id: prodId.data, proveedor_id: provId.data }, { status: 201 });
  }

  // ---- ALMACEN ----
  if (ownerType === 'almacen') {
    const almNombre = String(nombre).trim() || 'Almacén';

    const existente = await sb
      .from('almacenes')
      .select('id')
      .eq('empresa_id', perfil.empresa_id)
      .eq('nombre', String(almNombre))
      .maybeSingle();

    if (existente && existente.id) {
      return Response.json({ ok: true, id: existente.id, duplicado: true }, { status: 200 });
    }

    let { data: almId, error: errAlm } = await sb
      .from('almacenes')
      .insert({ empresa_id: perfil.empresa_id, nombre: String(almNombre) })
      .select('id')
      .single();

    if (errAlm) {
      if (errAlm.code === '23505') {
        const r = await sb
          .from('almacenes')
          .select('id')
          .eq('empresa_id', perfil.empresa_id)
          .eq('nombre', String(almNombre))
          .maybeSingle();
        return r ? r : { ok: false, error: 'Error creando almacén' };
      }
      return error('No se pudo crear almacén: ' + errAlm.message, 500);
    }

    return Response.json({ ok: true, id: almId.data }, { status: 201 });
  }

  return error('Tipo de dueño no reconocido');
}

export const POST = guardar;

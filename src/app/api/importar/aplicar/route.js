import { error, sesion, exigir, auditar, evento, manejar } from '@/lib/auth';
import { normalizarCodigo } from '@/services/texto';

export const runtime = 'nodejs';

/* POST /api/importar/aplicar { filas: [...], resolucion }
   Aplica el plan revisado por el usuario. Cada fila trae su accion
   (crear / actualizar / omitir), asi que nada se aplica a ciegas. */
async function aplicar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.crear');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const filas = Array.isArray(cuerpo.filas) ? cuerpo.filas : [];
  if (!filas.length) return error('No hay filas para importar');

  const { data: categorias } = await sb.from('categorias')
    .select('id, nombre').eq('empresa_id', perfil.empresa_id);

  const cache = new Map();
  for (const c of categorias || []) cache.set(String(c.nombre).toLowerCase(), c.id);

  const empresa = perfil.empresa_id;
  let creados = 0, actualizados = 0, omitidos = 0;
  const errores = [];

  for (const f of filas) {
    if (!f.datos || !f.datos.nombre) { omitidos++; continue; }
    const accion = f.accion || (f.estado === 'duplicado' ? 'omitir' : 'crear');
    if (accion === 'omitir') { omitidos++; continue; }

    const d = f.datos;
    const codigo = normalizarCodigo(d.codigo || f.codigoSugerido || '') || null;

    // Categoria: reutiliza la existente o la crea
    let categoriaId = null;
    if (d.categoria) {
      const clave = String(d.categoria).trim().toLowerCase();
      if (!cache.has(clave)) {
        const { data: nueva, error: errCat } = await sb.from('categorias')
          .insert({ empresa_id: empresa, nombre: d.categoria }).select('id').single();
        if (!errCat && nueva) { cache.set(clave, nueva.id); categoriaId = nueva.id; }
      } else {
        categoriaId = cache.get(clave);
      }
    }

    try {
      if (accion === 'actualizar') {
        let id = f.existente ? f.existente.id : null;
        if (!id && codigo) {
          const { data: encontrado } = await sb.from('productos')
            .select('id').eq('empresa_id', empresa).eq('codigo', codigo).maybeSingle();
          id = encontrado ? encontrado.id : null;
        }
        if (!id) throw new Error('No se encontro el producto a actualizar');

        const { error: err } = await sb.from('productos').update({
          nombre: d.nombre, categoria_id: categoriaId,
          stock_minimo: d.stock_minimo || 0, stock_maximo: d.stock_maximo || 0,
          stock_actual: d.stock_actual || 0, precio_compra: d.precio_compra || 0,
          precio_venta: d.precio_venta || 0, ubicacion: d.ubicacion || null,
          updated_at: new Date().toISOString(),
        }).eq('empresa_id', empresa).eq('id', id);
        if (err) throw err;
        actualizados++;
      } else {
        if (codigo) {
          const { data: choque } = await sb.from('productos')
            .select('id').eq('empresa_id', empresa).eq('codigo', codigo).maybeSingle();
          if (choque) throw new Error(`El codigo ${codigo} ya existe`);
        }
        const { error: err } = await sb.from('productos').insert({
          empresa_id: empresa, codigo, nombre: d.nombre, categoria_id: categoriaId,
          stock_minimo: d.stock_minimo || 0, stock_maximo: d.stock_maximo || 0,
          stock_actual: d.stock_actual || 0, precio_compra: d.precio_compra || 0,
          precio_venta: d.precio_venta || 0, ubicacion: d.ubicacion || null,
        });
        if (err) throw err;
        creados++;
      }
    } catch (err) {
      errores.push(`Fila ${f.fila}: ${err.message}`);
    }
  }

  await auditar(sb, perfil, {
    accion: 'importacion.aplicar', entidad: 'producto',
    detalle: `creados=${creados} actualizados=${actualizados} omitidos=${omitidos} errores=${errores.length}`,
  });
  await evento(sb, perfil, 'importacion.aplicar', `creados=${creados}`);

  return Response.json({ ok: true, creados, actualizados, omitidos, errores });
}

export const POST = manejar(aplicar);

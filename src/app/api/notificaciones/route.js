import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* GET /api/notificaciones -> notificaciones de mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  const { searchParams } = new URL(request.url);
  const soloNoLeidas = searchParams.get('no_leidas') === '1';
  let q = sb.from('notificaciones').select('*').eq('empresa_id', perfil.empresa_id).order('created_at', { ascending: false }).limit(100);
  if (soloNoLeidas) q = q.eq('leida', false);
  const { data, error: err } = await q;
  if (err) {
    if (/notificaciones|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, notificaciones: [], no_leidas: 0 });
    return error(err.message, 500);
  }
  const noLeidas = (data || []).filter((n) => !n.leida).length;
  return Response.json({ ok: true, notificaciones: data || [], no_leidas: noLeidas });
}

/* POST /api/notificaciones { accion: 'marcar_leida'|'marcar_todas'|'generar' } */
async function resolver(request) {
  const { perfil, sb } = await sesion(request);
  let cuerpo; try { cuerpo = await request.json(); } catch { cuerpo = {}; }
  const accion = String(cuerpo.accion || '').toLowerCase();

  if (accion === 'marcar_leida') {
    const id = String(cuerpo.id || '').trim();
    if (!id) return error('Falta el id');
    await sb.from('notificaciones').update({ leida: true }).eq('empresa_id', perfil.empresa_id).eq('id', id);
    return Response.json({ ok: true });
  }

  if (accion === 'marcar_todas') {
    await sb.from('notificaciones').update({ leida: true }).eq('empresa_id', perfil.empresa_id).eq('leida', false);
    return Response.json({ ok: true });
  }

  if (accion === 'generar') {
    // Genera notificaciones para stock bajo/agotado y CxC vencidas.
    let creadas = 0;
    // Stock bajo
    const { data: prods } = await sb.from('productos').select('id, nombre, codigo, stock_actual, stock_minimo').eq('empresa_id', perfil.empresa_id).eq('activo', true);
    for (const p of prods || []) {
      if (Number(p.stock_actual) <= 0) {
        const { data: existe } = await sb.from('notificaciones').select('id').eq('empresa_id', perfil.empresa_id).eq('tipo', 'stock').eq('entidad_id', p.id).eq('leida', false).maybeSingle();
        if (!existe) {
          await sb.from('notificaciones').insert({ empresa_id: perfil.empresa_id, tipo: 'stock', titulo: 'Producto agotado', mensaje: `${p.nombre} (${p.codigo || '-'}) esta agotado.`, entidad: 'producto', entidad_id: p.id });
          creadas++;
        }
      } else if (Number(p.stock_minimo) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo)) {
        const { data: existe } = await sb.from('notificaciones').select('id').eq('empresa_id', perfil.empresa_id).eq('tipo', 'stock').eq('entidad_id', p.id).eq('leida', false).maybeSingle();
        if (!existe) {
          await sb.from('notificaciones').insert({ empresa_id: perfil.empresa_id, tipo: 'stock', titulo: 'Stock bajo', mensaje: `${p.nombre} tiene ${p.stock_actual} unidades (minimo ${p.stock_minimo}).`, entidad: 'producto', entidad_id: p.id });
          creadas++;
        }
      }
    }
    // Stock por almacen agotado
    const { data: stockAlm } = await sb.from('producto_almacen').select('producto_id, almacen_id, cantidad').eq('empresa_id', perfil.empresa_id);
    const { data: almacenes } = await sb.from('almacenes').select('id, nombre').eq('empresa_id', perfil.empresa_id).eq('activo', true);
    const almMap = {};
    for (const a of almacenes || []) almMap[a.id] = a.nombre;
    const stockPorProd = {};
    for (const s of stockAlm || []) {
      if (!stockPorProd[s.producto_id]) stockPorProd[s.producto_id] = [];
      stockPorProd[s.producto_id].push(s);
    }
    for (const p of prods || []) {
      const filas = stockPorProd[p.id] || [];
      for (const f of filas) {
        if (Number(f.cantidad) <= 0 && Number(p.stock_actual) > 0) {
          const { data: existe } = await sb.from('notificaciones').select('id').eq('empresa_id', perfil.empresa_id).eq('tipo', 'stock').eq('entidad', 'almacen').eq('entidad_id', f.almacen_id).eq('leida', false).maybeSingle();
          if (!existe) {
            await sb.from('notificaciones').insert({
              empresa_id: perfil.empresa_id, tipo: 'stock',
              titulo: 'Stock agotado en almacen',
              mensaje: `${p.nombre} esta agotado en ${almMap[f.almacen_id] || 'un almacen'} (hay stock en otras ubicaciones).`,
              entidad: 'almacen', entidad_id: f.almacen_id,
            });
            creadas++;
          }
        }
      }
    }
    const hoy = new Date().toISOString().slice(0, 10);
    const { data: cxc } = await sb.from('cuentas_por_cobrar').select('id, saldo, fecha_vencimiento, clientes(nombre)').eq('empresa_id', perfil.empresa_id).in('estado', ['pendiente', 'parcial']);
    for (const c of cxc || []) {
      if (c.fecha_vencimiento && c.fecha_vencimiento < hoy) {
        const { data: existe } = await sb.from('notificaciones').select('id').eq('empresa_id', perfil.empresa_id).eq('tipo', 'cxc').eq('entidad_id', c.id).eq('leida', false).maybeSingle();
        if (!existe) {
          await sb.from('notificaciones').insert({ empresa_id: perfil.empresa_id, tipo: 'cxc', titulo: 'CxC vencida', mensaje: `${c.clientes ? c.clientes.nombre : 'Cliente'} tiene saldo vencido de ${c.saldo}.`, entidad: 'cxc', entidad_id: c.id });
          creadas++;
        }
      }
    }
    return Response.json({ ok: true, creadas });
  }

  return error('Accion invalida');
}

export const GET = manejar(listar);
export const POST = manejar(resolver);

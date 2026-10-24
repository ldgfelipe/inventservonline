import { error, sesion, auditar, manejar } from '@/lib/auth';
import { puede } from '@/services/permisos';

export const runtime = 'nodejs';

/* POST /api/asistente/ejecutar { accion }
   Ejecuta una accion propuesta por el asistente. Siempre vuelve a
   validar permisos aqui: la interfaz solo sugiere, el servidor decide. */
async function ejecutar(request) {
  const { perfil, sb, sbRpc } = await sesion(request);
  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const accion = cuerpo.accion || {};
  if (!accion.tipo) return error('Accion invalida');

  if (accion.tipo === 'confirmar_movimiento') {
    const esEntrada = accion.tipoMov === 'entrada';
    const permiso = esEntrada ? 'movimientos.entrada' : 'movimientos.salida';
    if (!puede(perfil.rol, permiso)) return error(`No tienes permiso (${permiso})`, 403);

    const { data, error: err } = await sbRpc.rpc('registrar_movimiento', {
      p_producto: accion.productoId,
      p_tipo: accion.tipoMov,
      p_cantidad: Number(accion.cantidad),
      p_precio: 0,
      p_observacion: 'Registrado por el asistente',
      p_proveedor: null,
    });
    if (err) return error(err.message, /insuficiente/i.test(err.message) ? 409 : 500);

    await auditar(sb, perfil, {
      accion: 'asistente.movimiento', entidad: 'producto', entidadId: accion.productoId,
      detalle: `${data.nombre}: ${accion.tipoMov} de ${accion.cantidad} (stock final ${data.stock_actual})`,
    });

    return Response.json({
      ok: true,
      texto: `Listo: ${esEntrada ? 'entrada' : 'salida'} de ${accion.cantidad} de ${data.nombre}. Stock actual: ${data.stock_actual}.`,
      movimiento: { nombre: data.nombre, stock_actual: data.stock_actual },
    });
  }

  if (accion.tipo === 'confirmar_minmax') {
    if (!puede(perfil.rol, 'productos.editar')) return error('No tienes permiso (productos.editar)', 403);
    const productoId = accion.productoId;
    const minimo = Number(accion.stock_minimo);
    const maximo = Number(accion.stock_maximo);
    if (!productoId || !Number.isFinite(minimo) || !Number.isFinite(maximo) || minimo < 0 || maximo < 0) {
      return error('Datos de minimo/maximo invalidos');
    }
    if (maximo > 0 && minimo > maximo) return error('El minimo no puede ser mayor que el maximo');
    const { error: err } = await sb.from('productos')
      .update({ stock_minimo: minimo, stock_maximo: maximo, updated_at: new Date().toISOString() })
      .eq('empresa_id', perfil.empresa_id).eq('id', productoId);
    if (err) return error(err.message, 500);
    await auditar(sb, perfil, {
      accion: 'asistente.minmax', entidad: 'producto', entidadId: productoId,
      detalle: `minimo ${minimo}, maximo ${maximo}`,
    });
    return Response.json({ ok: true, texto: `Listo: ${accion.productoNombre || 'el producto'} ahora tiene minimo ${minimo} y maximo ${maximo}.` });
  }

  if (accion.tipo === 'confirmar_notificacion') {
    const mensaje = String(accion.mensaje || '').trim();
    if (!mensaje) return error('Falta el mensaje del aviso');
    const fila = {
      empresa_id: perfil.empresa_id,
      tipo: 'info',
      titulo: String(accion.titulo || 'Aviso').slice(0, 120),
      mensaje: mensaje.slice(0, 1000),
      destino_area: accion.destino_area || null,
      destino_usuario: accion.destino_usuario || null,
      autor_id: perfil.id,
      autor_nombre: perfil.nombre,
    };
    let { error: err } = await sb.from('notificaciones').insert(fila);
    // Respaldo si aun no se aplico la migracion 041.
    if (err && /destino_|autor_|schema cache/i.test(err.message)) {
      const sinDestino = { ...fila };
      delete sinDestino.destino_area;
      delete sinDestino.destino_usuario;
      delete sinDestino.autor_id;
      delete sinDestino.autor_nombre;
      ({ error: err } = await sb.from('notificaciones').insert(sinDestino));
    }
    if (err) return error('No se pudo enviar el aviso: ' + err.message, 500);
    await auditar(sb, perfil, {
      accion: 'asistente.aviso', entidad: 'notificacion',
      detalle: `area ${fila.destino_area || 'todas'}: ${mensaje.slice(0, 200)}`,
    });
    return Response.json({
      ok: true,
      texto: `Aviso enviado${fila.destino_area ? ' al area ' + fila.destino_area : ' a toda la empresa'}.`,
    });
  }

  if (accion.tipo === 'aprender') {
    const frase = String(accion.frase || '').trim();
    if (!frase || !accion.productoId) return error('Falta la frase o el producto');
    await sb.from('asistente_alias').upsert({
      empresa_id: perfil.empresa_id, usuario_id: perfil.id, frase,
      producto_id: accion.productoId, usado: new Date().toISOString(),
    }, { onConflict: 'empresa_id,usuario_id,frase' });
    return Response.json({ ok: true, texto: 'Listo, la proxima vez entendere "' + frase + '" como ese producto.' });
  }

  // Acciones de interfaz: las interpreta el navegador
  return Response.json({ ok: true, accionUi: accion.tipo, datos: accion });
}

export const POST = manejar(ejecutar);

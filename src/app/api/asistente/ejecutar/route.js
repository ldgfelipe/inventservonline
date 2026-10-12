import { error, sesion, auditar, manejar } from '@/lib/auth';
import { puede } from '@/services/permisos';

export const runtime = 'nodejs';

/* POST /api/asistente/ejecutar { accion }
   Ejecuta una accion propuesta por el asistente. Siempre vuelve a
   validar permisos aqui: la interfaz solo sugiere, el servidor decide. */
async function ejecutar(request) {
  const { perfil, sb } = await sesion(request);
  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const accion = cuerpo.accion || {};
  if (!accion.tipo) return error('Accion invalida');

  if (accion.tipo === 'confirmar_movimiento') {
    const esEntrada = accion.tipoMov === 'entrada';
    const permiso = esEntrada ? 'movimientos.entrada' : 'movimientos.salida';
    if (!puede(perfil.rol, permiso)) return error(`No tienes permiso (${permiso})`, 403);

    const { data, error: err } = await sb.rpc('registrar_movimiento', {
      p_empresa: perfil.empresa_id,
      p_producto: accion.productoId,
      p_usuario: perfil.id,
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

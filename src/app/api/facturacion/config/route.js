import { error, sesion, exigir, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

const COLS = 'id, pais, proveedor, credenciales, rfc, regimen_fiscal, uso_cfdi, serie, folio_inicial, activo, status, ultimo_error';

/* GET /api/facturacion/config */
async function leer(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  const { data, error: err } = await sb.from('facturacion_config').select(COLS).eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (err) {
    if (/facturacion_config|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, config: null });
    return error(err.message, 500);
  }
  // No exponer credenciales completas; solo indicar si hay.
  if (data) {
    data.tiene_credenciales = !!(data.credenciales && Object.keys(data.credenciales).length);
    delete data.credenciales;
  }
  return Response.json({ ok: true, config: data || null });
}

/* POST /api/facturacion/config { pais, proveedor, credenciales?, rfc, regimen_fiscal, uso_cfdi, serie, folio_inicial, activo } */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'config.ver');
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const fila = {
    empresa_id: perfil.empresa_id,
    pais: cuerpo.pais || 'MX',
    proveedor: cuerpo.proveedor || 'manual',
    rfc: cuerpo.rfc || null,
    regimen_fiscal: cuerpo.regimen_fiscal || null,
    uso_cfdi: cuerpo.uso_cfdi || null,
    serie: cuerpo.serie || null,
    folio_inicial: Number(cuerpo.folio_inicial) || 1,
    activo: cuerpo.activo === true,
    status: cuerpo.activo === true ? 'en_pruebas' : 'no_configurado',
    updated_at: new Date().toISOString(),
  };
  if (cuerpo.credenciales && typeof cuerpo.credenciales === 'object') {
    fila.credenciales = cuerpo.credenciales;
  }

  const { data: existe } = await sb.from('facturacion_config').select('id').eq('empresa_id', perfil.empresa_id).maybeSingle();
  if (existe) {
    const { error: err } = await sb.from('facturacion_config').update(fila).eq('empresa_id', perfil.empresa_id);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  } else {
    const { error: err } = await sb.from('facturacion_config').insert(fila);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  }
  return Response.json({ ok: true });
}

export const GET = manejar(leer);
export const POST = manejar(guardar);

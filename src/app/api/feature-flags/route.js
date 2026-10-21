import { error, sesion, manejar } from '@/lib/auth';
import { admin } from '@/lib/supabase';

export const runtime = 'nodejs';

/* GET /api/feature-flags -> flags activos para mi empresa */
async function listar(request) {
  const { perfil, sb } = await sesion(request);
  const { data, error: err } = await sb.from('feature_flags').select('clave, descripcion, activo, porcentaje, empresas');
  if (err) {
    if (/feature_flags|does not exist|schema cache/i.test(err.message)) return Response.json({ ok: true, flags: {} });
    return error(err.message, 500);
  }
  const flags = {};
  for (const f of data || []) {
    if (!f.activo) { flags[f.clave] = false; continue; }
    // Si hay lista de empresas, solo esas la tienen
    if (f.empresas && f.empresas.length > 0) {
      flags[f.clave] = f.empresas.includes(perfil.empresa_id);
      continue;
    }
    // Rollout porcentual determinista por empresa
    const hash = hashEmpresa(perfil.empresa_id, f.clave);
    flags[f.clave] = hash < f.porcentaje;
  }
  return Response.json({ ok: true, flags });
}

/* POST /api/feature-flags { clave, activo?, porcentaje?, empresas?, descripcion? } (super-admin) */
async function guardar(request) {
  const { perfil, sb } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const clave = String(cuerpo.clave || '').trim();
  if (!clave) return error('Falta la clave');
  const fila = {
    clave,
    descripcion: cuerpo.descripcion || null,
    activo: cuerpo.activo !== false,
    porcentaje: Math.max(0, Math.min(100, Number(cuerpo.porcentaje) || 100)),
    empresas: Array.isArray(cuerpo.empresas) ? cuerpo.empresas : null,
    updated_at: new Date().toISOString(),
  };
  const { data: existe } = await sb.from('feature_flags').select('id').eq('clave', clave).maybeSingle();
  if (existe) {
    const { error: err } = await sb.from('feature_flags').update(fila).eq('clave', clave);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  } else {
    const { error: err } = await sb.from('feature_flags').insert(fila);
    if (err) return error('No se pudo guardar: ' + err.message, 500);
  }
  return Response.json({ ok: true });
}

/* GET /api/experimentos?nombre=... -> variante asignada (A/B) */
async function variante(request) {
  const { perfil, sb } = await sesion(request);
  const nombre = new URL(request.url).searchParams.get('nombre');
  if (!nombre) return error('Falta el nombre del experimento');
  // Ver si ya tiene asignacion
  const { data: existing } = await sb.from('experimentos').select('variante').eq('empresa_id', perfil.empresa_id).eq('experimento', nombre).maybeSingle();
  if (existing) return Response.json({ ok: true, variante: existing.variante });
  // Asignar variante determinista (50/50)
  const v = hashEmpresa(perfil.empresa_id, nombre) < 50 ? 'A' : 'B';
  await sb.from('experimentos').insert({ empresa_id: perfil.empresa_id, experimento: nombre, variante: v });
  return Response.json({ ok: true, variante: v });
}

function hashEmpresa(empresaId, clave) {
  let h = 0;
  const str = String(empresaId) + ':' + String(clave);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100;
}

export const GET = manejar(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.has('nombre')) return variante(req);
  return listar(req);
});
export const POST = manejar(guardar);

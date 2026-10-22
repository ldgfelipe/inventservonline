import { error, sesion, manejar } from '@/lib/auth';
import { leerConfigPagos } from '@/lib/pagos-config';
import { probarCredenciales } from '@/lib/pasarelas';

export const runtime = 'nodejs';

/* POST /api/admin/config-pagos/probar { pasarela } */
async function probar(request) {
  const { perfil } = await sesion(request);
  if (!perfil.super_admin) return error('Solo administradores de la plataforma', 403);
  let cuerpo; try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  const pasarela = String(cuerpo.pasarela || '').trim().toLowerCase();
  if (!['stripe', 'mercadopago', 'paypal'].includes(pasarela)) return error('Pasarela invalida');

  const config = await leerConfigPagos({ force: true });
  const r = await probarCredenciales(pasarela, config);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
  return Response.json({ ok: true, mensaje: r.mensaje });
}

export const POST = manejar(probar);

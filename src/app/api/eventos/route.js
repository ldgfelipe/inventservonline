import { error, sesion, evento, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/eventos { evento, contexto } -> registro de uso (adopcion).
   Nunca lanza error: fallar al medir no debe romper la accion del usuario. */
async function registrar(request) {
  try {
    const { perfil, sb } = await sesion(request);
    let cuerpo;
    try { cuerpo = await request.json(); } catch { cuerpo = {}; }
    if (!cuerpo.evento) return Response.json({ ok: true });
    await evento(sb, perfil, cuerpo.evento, cuerpo.contexto);
  } catch { /* silencioso a proposito */ }
  return Response.json({ ok: true });
}

export const POST = async (request, ctx) => {
  try { return await manejar(registrar)(request, ctx); }
  catch { return Response.json({ ok: true }); }
};

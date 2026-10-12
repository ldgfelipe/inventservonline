import { conJwt } from '@/lib/supabase';
import { error, tokenDe } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/auth/logout */
export async function POST(request) {
  const token = tokenDe(request);
  if (token) {
    // Revoca la sesion; si falla, el cliente igual borra sus tokens
    await conJwt(token).auth.signOut().catch(() => {});
  }
  return Response.json({ ok: true });
}

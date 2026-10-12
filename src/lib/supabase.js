import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function falta(nombre) {
  throw new Error(`Falta la variable de entorno ${nombre}`);
}

/* Cliente con service_role: salta el RLS. Solo para registro y tareas
   administrativas del servidor. NUNCA se expone al navegador. */
export function admin() {
  if (!URL) falta('NEXT_PUBLIC_SUPABASE_URL');
  if (!SERVICE) falta('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* Cliente vinculado al token del usuario: el RLS decide que ve.
   Es el que usan todas las rutas de datos. */
export function conJwt(token) {
  if (!URL || !ANON) falta('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export { URL as supabaseUrl, ANON as anonKey };

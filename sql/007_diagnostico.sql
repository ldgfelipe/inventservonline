-- ============================================================
--  DIAGNOSTICO: que ve la base de datos cuando la app pregunta
-- ============================================================

create or replace function public.diagnostico_json()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'auth_uid',      auth.uid()::text,
    'empresa_actual', public.empresa_actual()::text,
    'rol_jwt',       current_setting('request.jwt.claim.role', true),
    'usando_rls',    (select relrowsecurity from pg_class where oid = 'public.perfiles'::regclass),
    'policies_perfiles', (
      select json_agg(policyname order by policyname)
      from pg_policies
      where schemaname = 'public' and tablename = 'perfiles'
    )
  );
$$;

-- PRUEBA MANUAL: ejecuta esto estando SIN sesion en el SQL Editor para
-- ver las policies que existen de verdad.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('perfiles', 'empresas', 'productos')
order by tablename, policyname;

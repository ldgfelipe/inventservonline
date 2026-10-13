-- DIAGNOSTICO: ejecuta y mira los tres resultados

-- 1. ¿Existe el usuario?
select id, email, email_confirmed_at, created_at
from auth.users
where email = 'ldgframe@gmail.com';

-- 2. ¿Tiene perfil? (pega aqui el id del resultado anterior)
select id, empresa_id, nombre, rol, super_admin
from public.perfiles
where id = (select id from auth.users where email = 'ldgframe@gmail.com');

-- 3. ¿Existe la empresa?
select id, nombre, giro_actual, created_at
from public.empresas
order by created_at desc
limit 10;

-- 4. ¿Cuantas empresas y perfiles hay en total?
select
  (select count(*) from public.empresas)  as empresas,
  (select count(*) from public.perfiles)  as perfiles,
  (select count(*) from auth.users)       as usuarios_auth;

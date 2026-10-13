-- ============================================================
--  REPARACION: crear empresa y perfil para un usuario de auth
--  que ya existe pero se quedo sin perfil (de ahi el error
--  "La cuenta no tiene empresa asignada").
--
--  No toca la contrasena: el usuario sigue entrando con la suya.
--  Es idempotente: si ya tiene perfil, no hace nada.
-- ============================================================

do $$
declare
  v_usuario_id uuid;
  v_empresa_id uuid := gen_random_uuid();
  v_email      text := 'ldgframe@gmail.com';
begin
  select id into v_usuario_id from auth.users where email = v_email;

  if v_usuario_id is null then
    raise exception 'No existe el usuario % en auth.users', v_email;
  end if;

  if exists (select 1 from public.perfiles where id = v_usuario_id) then
    raise notice 'El usuario % YA tiene perfil. Revisa las politicas RLS, no la falta de perfil.', v_email;
    return;
  end if;

  -- ¿Hay empresas huerfanas de un intento fallido? Reutilizamos la mas reciente
  -- solo si no tiene ningun perfil; si no, creamos una nueva.
  select id into v_empresa_id
  from public.empresas e
  where not exists (select 1 from public.perfiles p where p.empresa_id = e.id)
  order by e.created_at desc
  limit 1;

  if v_empresa_id is null then
    insert into public.empresas (nombre, email, giro_actual)
    values ('Inventarios', v_email, 'Otro')
    returning id into v_empresa_id;
  else
    raise notice 'Reutilizando empresa huerfana existente (id %)', v_empresa_id;
  end if;

  insert into public.perfiles (id, empresa_id, nombre, rol, area, super_admin)
  values (v_usuario_id, v_empresa_id, 'Administrador', 'admin', 'Administracion', true);

  -- Categoria inicial si la empresa no tiene ninguna
  if not exists (select 1 from public.categorias where empresa_id = v_empresa_id) then
    insert into public.categorias (empresa_id, nombre) values (v_empresa_id, 'General');
  end if;

  raise notice 'LISTO: empresa % y perfil administrador creados para %', v_empresa_id, v_email;
end $$;

-- VERIFICACION: debe devolver una fila
select p.id, p.nombre, p.rol, p.super_admin, e.nombre as empresa, e.giro_actual
from public.perfiles p
join public.empresas e on e.id = p.empresa_id
where p.id = (select id from auth.users where email = 'ldgframe@gmail.com');

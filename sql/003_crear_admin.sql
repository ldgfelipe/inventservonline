-- ============================================================
--  PASO 1: migracion 002 (idempotente, se puede reejecutar)
--  Agrega super_admin, la tabla de claves y el catalogo de giros.
-- ============================================================

alter table public.perfiles
  add column if not exists super_admin boolean not null default false;

create table if not exists public.claves_admin (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  descripcion text,
  usos        integer not null default 0,
  max_usos    integer not null default 1,
  activa      boolean not null default true,
  expira_en   timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.claves_admin enable row level security;

drop policy if exists "super admin lee claves" on public.claves_admin;
create policy "super admin lee claves" on public.claves_admin
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "super admin modifica claves" on public.claves_admin;
create policy "super admin modifica claves" on public.claves_admin
  for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "super admin lee todos los perfiles" on public.perfiles;
create policy "super admin lee todos los perfiles" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or empresa_id = public.empresa_actual() or exists (
    select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

create or replace function public.consumir_clave_admin(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.claves_admin c
  set usos = c.usos + 1,
      activa = case when c.usos + 1 >= c.max_usos then false else c.activa end
  where c.codigo = p_codigo
    and c.activa
    and c.usos < c.max_usos
    and (c.expira_en is null or c.expira_en > now())
  returning c.id into v_id;

  return v_id;
end $$;

insert into public.giros (nombre) values
  ('Construccion'), ('Farmacia'), ('Ferreteria'), ('Materiales de construccion'),
  ('Alimentos y bebidas'), ('Supermercado y abastos'), ('Restaurante y cafeteria'),
  ('Panaderia y pasteleria'), ('Ropa, calzado y accesorios'), ('Belleza y cuidado personal'),
  ('Salon de belleza y barberia'), ('Electronica y tecnologia'), ('Repuestos y automotriz'),
  ('Muebles y decoracion'), ('Jugueteria y articulos infantiles'), ('Papeleria y oficina'),
  ('Limpieza y desinfeccion'), ('Agropecuaria e insumos'), ('Veterinaria y mascotas'),
  ('Clinica y consultorio'), ('Odontologia'), ('Optica'), ('Laboratorio'),
  ('Gimnasio y deporte'), ('Lavanderia y tintoreria'), ('Hoteleria'),
  ('Transporte y logistica'), ('Distribuidora y mayorista'), ('Servicios profesionales'), ('Otro')
on conflict (nombre) do nothing;

-- ============================================================
--  PASO 2: crear el administrador
--  (se ejecuta solo si el usuario no existe)
-- ============================================================

do $$
declare
  v_usuario_id  uuid := gen_random_uuid();
  v_empresa_id  uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'ldgframe@gmail.com') then
    raise exception 'El usuario ldgframe@gmail.com ya existe. No se creo nada.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_usuario_id, 'authenticated', 'authenticated',
    'ldgframe@gmail.com',
    -- CAMBIA esta contrasena antes de ejecutar. No la dejes en el repo.
    extensions.crypt('CAMBIAR-CONTRASENA', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_usuario_id, v_usuario_id,
    jsonb_build_object('sub', v_usuario_id::text, 'email', 'ldgframe@gmail.com',
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  insert into public.empresas (id, nombre, email, giro_actual)
  values (v_empresa_id, 'Inventarios', 'ldgframe@gmail.com', 'Otro');

  insert into public.perfiles (id, empresa_id, nombre, rol, area, super_admin)
  values (v_usuario_id, v_empresa_id, 'Administrador', 'admin', 'Administracion', true);

  insert into public.categorias (empresa_id, nombre)
  values (v_empresa_id, 'General');

  raise notice 'Usuario administrador creado: ldgframe@gmail.com';
end $$;

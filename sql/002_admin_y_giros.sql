-- ============================================================
--  Migracion 002: claves de administrador + catalogo ampliado de giros
--  Ejecutar DESPUES de 001_schema.sql en el SQL Editor de Supabase.
--  Es idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
--  1. Catalogo de giros ampliado a categorias generales
--     (Construccion y Farmacia conservan sus campos especificos)
-- ------------------------------------------------------------
insert into public.giros (nombre) values
  ('Construccion'),
  ('Farmacia'),
  ('Ferreteria'),
  ('Materiales de construccion'),
  ('Alimentos y bebidas'),
  ('Supermercado y abastos'),
  ('Restaurante y cafeteria'),
  ('Panaderia y pasteleria'),
  ('Ropa, calzado y accesorios'),
  ('Belleza y cuidado personal'),
  ('Salon de belleza y barberia'),
  ('Electronica y tecnologia'),
  ('Repuestos y automotriz'),
  ('Muebles y decoracion'),
  ('Jugueteria y articulos infantiles'),
  ('Papeleria y oficina'),
  ('Limpieza y desinfeccion'),
  ('Agropecuaria e insumos'),
  ('Veterinaria y mascotas'),
  ('Clinica y consultorio'),
  ('Odontologia'),
  ('Optica'),
  ('Laboratorio'),
  ('Gimnasio y deporte'),
  ('Lavanderia y tintoreria'),
  ('Hoteleria'),
  ('Transporte y logistica'),
  ('Distribuidora y mayorista'),
  ('Servicios profesionales'),
  ('Otro')
on conflict (nombre) do nothing;

-- ------------------------------------------------------------
--  2. Claves de administrador
--     Codigos de acceso para dar de alta administradores de la
--     plataforma (super admin). Se consumen al usarlas.
-- ------------------------------------------------------------
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

-- Los super admin pueden ver y gestionar las claves.
-- Nadie mas (ni con service_role saltandose RLS por error) puede leerlas.
drop policy if exists "super admin lee claves" on public.claves_admin;
create policy "super admin lee claves" on public.claves_admin
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "super admin modifica claves" on public.claves_admin;
create policy "super admin modifica claves" on public.claves_admin
  for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

-- Marca de super admin en el perfil
alter table public.perfiles
  add column if not exists super_admin boolean not null default false;

-- Un super admin ve los perfiles de TODAS las empresas (para dar soporte),
-- pero sigue sin poder escribir en empresas ajenas.
drop policy if exists "super admin lee todos los perfiles" on public.perfiles;
create policy "super admin lee todos los perfiles" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or empresa_id = public.empresa_actual() or exists (
    select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

-- ------------------------------------------------------------
--  3. Consumir una clave (la llama el servidor al registrar)
--     Devuelve el id si la clave sirve, o NULL si no.
--     Se hace en la base para evitar usar una clave dos veces
--     si dos registros llegan al mismo tiempo.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
--  4. Crear tu primera clave maestra.
--     CAMBIA el valor de ejemplo por uno solo tuyo y ejecuta
--     esta linea. Guardala: es lo que te da acceso de
--     administrador de la plataforma al registrarte.
-- ------------------------------------------------------------
-- insert into public.claves_admin (codigo, descripcion, max_usos)
-- values ('TU-CODIGO-SECRETO', 'Clave maestra del sistema', 1);

-- ============================================================
--  Migracion 029: feature flags y experimentos A/B
--
--  Ejecutar DESPUES de 028_producto_adjuntos.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

-- Feature flags globales (controlados por super-admin)
create table if not exists public.feature_flags (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null unique,
  descripcion text,
  activo      boolean not null default false,
  porcentaje  integer not null default 100 check (porcentaje between 0 and 100),
  empresas    text[],   -- null = todas; lista de empresa_id para beta
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Asignacion de experimentos por empresa (A/B testing)
create table if not exists public.experimentos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  experimento text not null,
  variante    text not null default 'A',
  created_at  timestamptz not null default now(),
  unique (empresa_id, experimento)
);

-- RLS
alter table public.feature_flags enable row level security;
alter table public.experimentos enable row level security;

-- Feature flags: todos pueden leer, solo super-admin escribe
drop policy if exists "leer feature_flags" on public.feature_flags;
create policy "leer feature_flags" on public.feature_flags
  for select to authenticated using (true);

drop policy if exists "superadmin escribe feature_flags" on public.feature_flags;
create policy "superadmin escribe feature_flags" on public.feature_flags
  for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

-- Experimentos: mi empresa
drop policy if exists "leer experimentos" on public.experimentos;
create policy "leer experimentos" on public.experimentos
  for select to authenticated using (empresa_id = public.empresa_actual());

drop policy if exists "insertar experimentos" on public.experimentos;
create policy "insertar experimentos" on public.experimentos
  for insert to authenticated with check (empresa_id = public.empresa_actual());

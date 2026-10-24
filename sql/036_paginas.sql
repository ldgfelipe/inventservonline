-- ============================================================
--  Migracion 036: paginas publicas (landing / blog)
--
--  El super-admin puede crear paginas de aterrizaje y blog desde
--  /admin -> Paginas. Se renderizan publicamente en /p/{slug}.
--
--  Ejecutar DESPUES de 035_metodos_pago.sql.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.paginas (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  titulo     text not null,
  tipo       text not null default 'landing' check (tipo in ('landing','blog')),
  html       text not null default '',
  publicado  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_paginas_slug on public.paginas(slug);

alter table public.paginas enable row level security;

drop policy if exists "superadmin gestiona paginas" on public.paginas;
create policy "superadmin gestiona paginas" on public.paginas
  for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

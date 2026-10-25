-- ============================================================
--  Migracion 042: configuracion global del sitio (pixeles/SEO)
--
--  Guarda los IDs de Google Analytics / Tag Manager y los bloques
--  de codigo personalizados que el super-admin agrega desde /admin.
--
--  Ejecutar DESPUES de 041_avisos_dirigidos.sql.
--  Idempotente.
-- ============================================================

create table if not exists public.configuracion_sitio (
  id               integer primary key default 1,
  ga_measurement_id text,
  gtm_id           text,
  head_code        text,
  body_open_code   text,
  body_close_code  text,
  updated_at       timestamptz not null default now()
);

insert into public.configuracion_sitio (id)
values (1)
on conflict (id) do nothing;

alter table public.configuracion_sitio enable row level security;

drop policy if exists "superadmin gestiona configuracion_sitio" on public.configuracion_sitio;
create policy "superadmin gestiona configuracion_sitio" on public.configuracion_sitio
  for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

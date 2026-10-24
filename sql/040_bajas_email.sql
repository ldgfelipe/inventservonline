-- ============================================================
--  Migracion 040: bajas de correo (unsubscribe)
--
--  Registra los correos que piden darse de baja desde el enlace de
--  la campana. El envio se hace desde un sistema local; aqui solo se
--  guarda la baja para que el administrador la pueda emparejar con
--  su listado.
--
--  Ejecutar DESPUES de 039_honeypot_bots.sql.
--  Idempotente.
-- ============================================================

create table if not exists public.email_bajas (
  id          uuid primary key default gen_random_uuid(),
  campana_id  uuid references public.campanas(id) on delete set null,
  email       text not null,
  token       text,
  motivo      text,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Un correo se da de baja una sola vez (global).
create unique index if not exists idx_email_bajas_email on public.email_bajas(email);
create index if not exists idx_email_bajas_campana on public.email_bajas(campana_id, created_at desc);
create index if not exists idx_email_bajas_fecha on public.email_bajas(created_at desc);

alter table public.email_bajas enable row level security;

drop policy if exists "insertar bajas" on public.email_bajas;
create policy "insertar bajas" on public.email_bajas
  for insert to anon, authenticated with check (true);

drop policy if exists "superadmin lee bajas" on public.email_bajas;
create policy "superadmin lee bajas" on public.email_bajas
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

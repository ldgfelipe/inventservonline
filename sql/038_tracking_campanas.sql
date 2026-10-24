-- ============================================================
--  Migracion 038: seguimiento de campanas y pixel de correo
--
--  - Codigo corto y token de pixel por campana.
--  - Identificador de visitante/sesion en el trafico (para unicos).
--  - Eventos de email (aperturas) para saber quien abrio el correo.
--
--  Ejecutar DESPUES de 037_landing_olvidate_excel.sql.
--  Idempotente.
-- ============================================================

do $$
begin
  if to_regclass('public.campanas') is not null then
    alter table public.campanas
      add column if not exists codigo text,
      add column if not exists email_pixel_token text;
    create unique index if not exists idx_campanas_codigo
      on public.campanas(codigo) where codigo is not null;
    create unique index if not exists idx_campanas_pixel
      on public.campanas(email_pixel_token) where email_pixel_token is not null;
  end if;

  if to_regclass('public.trafico') is not null then
    alter table public.trafico
      add column if not exists visitante_id text,
      add column if not exists sesion_id text;
    create index if not exists idx_trafico_visitante
      on public.trafico(visitante_id, created_at desc);

    alter table public.trafico drop constraint if exists trafico_evento_check;
    alter table public.trafico add constraint trafico_evento_check
      check (evento in ('visita','registro','conversion','pago','demo','click','email_open'));
  end if;
end $$;

create table if not exists public.email_eventos (
  id          uuid primary key default gen_random_uuid(),
  campana_id  uuid references public.campanas(id) on delete set null,
  token       text,
  tipo        text not null default 'apertura' check (tipo in ('apertura','click')),
  email       text,
  ip          text,
  user_agent  text,
  url         text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_email_eventos_campana
  on public.email_eventos(campana_id, created_at desc);
create index if not exists idx_email_eventos_tipo
  on public.email_eventos(tipo, created_at desc);

alter table public.email_eventos enable row level security;

drop policy if exists "superadmin lee email_eventos" on public.email_eventos;
create policy "superadmin lee email_eventos" on public.email_eventos
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "insertar email_eventos" on public.email_eventos;
create policy "insertar email_eventos" on public.email_eventos
  for insert to anon, authenticated with check (true);

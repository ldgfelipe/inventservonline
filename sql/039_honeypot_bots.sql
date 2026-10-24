-- ============================================================
--  Migracion 039: honeypot y exclusion de bots en estadisticas
--
--  Los validadores de correo (Proofpoint, Mimecast, etc.) abren el
--  pixel y siguen enlaces, inflando aperturas y clicks. Se agrega:
--   - bot / motivo_bot en email_eventos y trafico
--   - tipo 'honeypot' para el enlace trampa
--
--  Ejecutar DESPUES de 038_tracking_campanas.sql.
--  Idempotente.
-- ============================================================

alter table if exists public.email_eventos
  add column if not exists bot boolean not null default false,
  add column if not exists motivo_bot text;

alter table if exists public.trafico
  add column if not exists bot boolean not null default false,
  add column if not exists motivo_bot text;

do $$
begin
  if to_regclass('public.email_eventos') is not null then
    alter table public.email_eventos drop constraint if exists email_eventos_tipo_check;
    alter table public.email_eventos add constraint email_eventos_tipo_check
      check (tipo in ('apertura','click','honeypot'));
  end if;
end $$;

create index if not exists idx_email_eventos_bot
  on public.email_eventos(bot, created_at desc);
create index if not exists idx_trafico_bot
  on public.trafico(bot, created_at desc);

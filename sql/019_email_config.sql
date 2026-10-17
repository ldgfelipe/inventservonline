-- ============================================================
--  Migracion 019: configuracion de correo (notificaciones por email)
--
--  Ejecutar DESPUES de 018_notificaciones.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.email_config (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null unique references public.empresas(id) on delete cascade,
  activo      boolean not null default false,
  smtp_host   text,
  smtp_port   integer default 587,
  smtp_user   text,
  smtp_pass   text,
  from_name   text,
  from_email  text,
  to_emails   text,        -- lista separada por comas
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table public.email_config enable row level security;
do $$
declare t text := 'email_config';
begin
  execute format('drop policy if exists "leer %1$s" on public.%1$I', t);
  execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "insertar %1$s" on public.%1$I', t);
  execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "actualizar %1$s" on public.%1$I', t);
  execute format('create policy "actualizar %1$s" on public.%1$I for update to authenticated using (empresa_id = public.empresa_actual()) with check (empresa_id = public.empresa_actual())', t);
end $$;

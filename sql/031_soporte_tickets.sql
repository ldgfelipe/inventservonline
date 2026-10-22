-- ============================================================
--  Migracion 031: soporte (tickets)
--
--  Ejecutar DESPUES de 030_marketing_tracking.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.soporte_tickets (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  usuario_id  uuid,
  usuario     text,
  asunto      text not null,
  descripcion text not null,
  categoria   text not null default 'general'
                check (categoria in ('general','error','facturacion','pagos','sugerencia','acceso')),
  prioridad   text not null default 'media'
                check (prioridad in ('baja','media','alta','urgente')),
  estado      text not null default 'abierto'
                check (estado in ('abierto','en_proceso','resuelto','cerrado')),
  respuesta   text,
  respondido_por uuid,
  respondido_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tickets_empresa on public.soporte_tickets(empresa_id, created_at desc);
create index if not exists idx_tickets_estado on public.soporte_tickets(estado);

-- RLS
alter table public.soporte_tickets enable row level security;

drop policy if exists "leer tickets propios" on public.soporte_tickets;
create policy "leer tickets propios" on public.soporte_tickets
  for select to authenticated
  using (empresa_id = public.empresa_actual()
     or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "insertar tickets" on public.soporte_tickets;
create policy "insertar tickets" on public.soporte_tickets
  for insert to authenticated
  with check (empresa_id = public.empresa_actual());

drop policy if exists "superadmin responde tickets" on public.soporte_tickets;
create policy "superadmin responde tickets" on public.soporte_tickets
  for update to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

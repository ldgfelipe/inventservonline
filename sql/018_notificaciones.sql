-- ============================================================
--  Migracion 018: notificaciones in-app
--
--  Ejecutar DESPUES de 017_caja_arqueo.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  tipo        text not null default 'info'
                check (tipo in ('info','alerta','stock','cxc','cxp','sistema')),
  titulo      text not null,
  mensaje     text,
  entidad     text,
  entidad_id  uuid,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notif_empresa on public.notificaciones(empresa_id, created_at desc);
create index if not exists idx_notif_leida on public.notificaciones(empresa_id, leida);

-- RLS
alter table public.notificaciones enable row level security;
do $$
declare t text := 'notificaciones';
begin
  execute format('drop policy if exists "leer %1$s" on public.%1$I', t);
  execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "insertar %1$s" on public.%1$I', t);
  execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "actualizar %1$s" on public.%1$I', t);
  execute format('create policy "actualizar %1$s" on public.%1$I for update to authenticated using (empresa_id = public.empresa_actual()) with check (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "borrar %1$s" on public.%1$I', t);
  execute format('create policy "borrar %1$s" on public.%1$I for delete to authenticated using (empresa_id = public.empresa_actual())', t);
end $$;

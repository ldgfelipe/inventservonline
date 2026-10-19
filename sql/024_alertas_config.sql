-- ============================================================
--  Migracion 024: configuracion de alertas por empresa
--
--  Ejecutar DESPUES de 023_traslados.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.alertas_config (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null unique references public.empresas(id) on delete cascade,
  stock_bajo      boolean not null default true,
  stock_agotado   boolean not null default true,
  stock_almacen   boolean not null default true,
  cxc_vencida     boolean not null default true,
  cxp_vencida     boolean not null default true,
  caja_diferencia boolean not null default true,
  umbral_stock_pct integer not null default 100,  -- % del minimo para alertar (100 = al llegar al minimo)
  dias_cxc        integer not null default 0,      -- dias de gracia antes de alertar CxC
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- RLS
alter table public.alertas_config enable row level security;
do $$
declare t text := 'alertas_config';
begin
  execute format('drop policy if exists "leer %1$s" on public.%1$I', t);
  execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "insertar %1$s" on public.%1$I', t);
  execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "actualizar %1$s" on public.%1$I', t);
  execute format('create policy "actualizar %1$s" on public.%1$I for update to authenticated using (empresa_id = public.empresa_actual()) with check (empresa_id = public.empresa_actual())', t);
end $$;

-- ============================================================
--  Migracion 013: planes, freemium, limites, multi-almacen y pagos SaaS
--
--  Ejecutar DESPUES de 012_pais_y_moneda.sql en el SQL Editor de Supabase.
--  Es idempotente: se puede ejecutar varias veces sin romper nada.
--
--  IMPORTANTE: los LIMITES de cada plan NO viven en la base, sino en
--  src/lib/planes.js (asi el sistema sigue funcionando aunque esta
--  migracion no este aplicada). Aqui solo se guarda el PLAN CONTRATADO
--  y su ESTADO/VIGENCIA por empresa.
--
--  Resiliencia en el backend: si esta migracion no esta aplicada,
--  src/lib/licenciamiento.js no aplica limites y el sistema opera igual.
-- ============================================================

-- ------------------------------------------------------------
--  1. Suscripcion por empresa (plan + estado + vigencia)
-- ------------------------------------------------------------
create table if not exists public.suscripciones_empresas (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null unique references public.empresas(id) on delete cascade,
  plan              text not null default 'free'
                      check (plan in ('free','basic','pro')),
  estado            text not null default 'trial'
                      check (estado in ('activo','trial','vencido','en_revision')),
  trial_ends_at     timestamptz,
  fecha_vencimiento timestamptz,
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
--  2. Almacenes (multi-almacen: solo plan Pro)
--     Cada empresa tiene SIEMPRE un almacen "Principal".
-- ------------------------------------------------------------
create table if not exists public.almacenes (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre     text not null,
  direccion  text,
  principal  boolean not null default false,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_almacen_principal
  on public.almacenes (empresa_id) where principal;
create index if not exists idx_almacenes_empresa
  on public.almacenes (empresa_id);

-- ------------------------------------------------------------
--  3. Stock por almacen (estructura para multi-almacen)
--     Se mantiene desde la fase de multi-almacen. Por ahora queda
--     creada para que la funcion de movimientos pueda poblarla.
-- ------------------------------------------------------------
create table if not exists public.producto_almacen (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  almacen_id  uuid not null references public.almacenes(id) on delete cascade,
  cantidad    integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (producto_id, almacen_id)
);
create index if not exists idx_producto_almacen_empresa
  on public.producto_almacen (empresa_id);

-- ------------------------------------------------------------
--  4. Almacen de origen en cada movimiento (nullable: los movimientos
--     anteriores a esta migracion no tienen almacen asignado).
-- ------------------------------------------------------------
alter table public.movimientos
  add column if not exists almacen_id uuid references public.almacenes(id) on delete set null;

-- ------------------------------------------------------------
--  5. Historial de pagos del SaaS (pasarelas y transferencias)
-- ------------------------------------------------------------
create table if not exists public.pagos_saas_historial (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  plan               text,
  monto              numeric(14,2) not null default 0,
  moneda             text not null default 'USD',
  pasarela           text not null default 'transferencia'
                       check (pasarela in ('stripe','mercadopago','paypal','transferencia','manual')),
  referencia_externa text,
  comprobante_url    text,
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente','en_revision','aprobado','rechazado','fallido')),
  periodo_desde      date,
  periodo_hasta      date,
  aprobado_por       uuid,
  aprobado_at        timestamptz,
  nota               text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_pagos_saas_empresa
  on public.pagos_saas_historial (empresa_id, created_at desc);
create index if not exists idx_pagos_saas_estado
  on public.pagos_saas_historial (estado);

-- ------------------------------------------------------------
--  6. Datos iniciales
--     - Suscripcion para cada empresa existente. Las cuentas actuales
--       quedan ACTIVAS (sin vencimiento) para no cortarles el servicio:
--       si su plan no es free/basic/pro se asume 'pro' (grandfathered).
--     - Almacen "Principal" para cada empresa que aun no lo tenga.
-- ------------------------------------------------------------
insert into public.suscripciones_empresas (empresa_id, plan, estado, trial_ends_at, fecha_vencimiento)
select e.id,
       case when e.plan in ('free','basic','pro') then e.plan else 'pro' end,
       'activo',
       null,
       null
from public.empresas e
on conflict (empresa_id) do nothing;

insert into public.almacenes (empresa_id, nombre, principal, activo)
select e.id, 'Principal', true, true
from public.empresas e
where not exists (
  select 1 from public.almacenes a where a.empresa_id = e.id and a.principal
);

-- ------------------------------------------------------------
--  7. RLS (segunda capa de defensa, igual que el resto del esquema)
-- ------------------------------------------------------------
alter table public.suscripciones_empresas enable row level security;
alter table public.almacenes             enable row level security;
alter table public.producto_almacen      enable row level security;
alter table public.pagos_saas_historial  enable row level security;

-- Suscripcion: mi empresa; el super admin ve todas
drop policy if exists "leer suscripcion" on public.suscripciones_empresas;
create policy "leer suscripcion" on public.suscripciones_empresas
  for select to authenticated
  using (
    empresa_id = public.empresa_actual()
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin)
  );

-- Pagos SaaS: mi empresa; el super admin ve todos
drop policy if exists "leer pagos saas" on public.pagos_saas_historial;
create policy "leer pagos saas" on public.pagos_saas_historial
  for select to authenticated
  using (empresa_id = public.empresa_actual()
     or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

-- Almacenes y stock por almacen: patron estandar por empresa
do $$
declare tabla text;
begin
  foreach tabla in array array['almacenes','producto_almacen']
  loop
    execute format('drop policy if exists "leer %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "leer %1$s" on public.%1$I for select to authenticated
       using (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "insertar %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "insertar %1$s" on public.%1$I for insert to authenticated
       with check (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "actualizar %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "actualizar %1$s" on public.%1$I for update to authenticated
       using (empresa_id = public.empresa_actual())
       with check (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "borrar %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "borrar %1$s" on public.%1$I for delete to authenticated
       using (empresa_id = public.empresa_actual())', tabla);
  end loop;
end $$;

-- ------------------------------------------------------------
--  8. Verificacion
-- ------------------------------------------------------------
select 'suscripciones' as tabla, count(*) from public.suscripciones_empresas
union all
select 'almacenes', count(*) from public.almacenes
union all
select 'pagos_saas', count(*) from public.pagos_saas_historial;

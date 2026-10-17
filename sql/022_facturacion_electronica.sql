-- ============================================================
--  Migracion 022: facturacion electronica (config + solicitudes)
--
--  Ejecutar DESPUES de 021_caja_detallado.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
--
--  Diseno flexible: soporta multiples proveedores por pais. Los
--  proveedores soportados viven en src/lib/facturacion/ (registro).
--  Si un usuario necesita un proveedor/pais no soportado, crea una
--  solicitud (facturacion_solicitudes) que el super-admin gestiona.
-- ============================================================

-- Configuracion de facturacion por empresa
create table if not exists public.facturacion_config (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null unique references public.empresas(id) on delete cascade,
  pais          text not null default 'MX',
  proveedor     text not null default 'manual'
                  check (proveedor in ('manual','facturama','sw_sapien','sat_direct','custom')),
  credenciales  jsonb not null default '{}'::jsonb,
  rfc           text,
  regimen_fiscal text,
  uso_cfdi      text,
  serie         text,
  folio_inicial integer default 1,
  activo        boolean not null default false,
  status        text not null default 'no_configurado'
                  check (status in ('no_configurado','en_pruebas','activo','suspendido','error')),
  ultimo_error  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Solicitudes de integracion (cuando el proveedor/pais no esta soportado)
create table if not exists public.facturacion_solicitudes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  pais            text not null,
  proveedor       text,
  descripcion     text,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','en_investigacion','implementado','rechazado')),
  notas_admin     text,
  implementado_en timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_fact_sol_empresa on public.facturacion_solicitudes(empresa_id);
create index if not exists idx_fact_sol_estado on public.facturacion_solicitudes(estado);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['facturacion_config','facturacion_solicitudes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "leer %1$s" on public.%1$I', t);
    execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', t);
    execute format('drop policy if exists "insertar %1$s" on public.%1$I', t);
    execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', t);
    execute format('drop policy if exists "actualizar %1$s" on public.%1$I', t);
    execute format('create policy "actualizar %1$s" on public.%1$I for update to authenticated using (empresa_id = public.empresa_actual()) with check (empresa_id = public.empresa_actual())', t);
  end loop;
end $$;

-- El super-admin puede leer todas las solicitudes (para gestionarlas).
drop policy if exists "superadmin lee solicitudes" on public.facturacion_solicitudes;
create policy "superadmin lee solicitudes" on public.facturacion_solicitudes
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "superadmin actualiza solicitudes" on public.facturacion_solicitudes;
create policy "superadmin actualiza solicitudes" on public.facturacion_solicitudes
  for update to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

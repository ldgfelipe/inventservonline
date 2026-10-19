-- ============================================================
--  Migracion 028: adjuntos de productos
--
--  Ejecutar DESPUES de 027_logo_empresa.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.producto_adjuntos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  ruta        text not null,
  nombre      text,
  tipo        text,
  tamano      bigint default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_prod_adjuntos on public.producto_adjuntos(producto_id);

-- RLS
alter table public.producto_adjuntos enable row level security;
do $$
declare t text := 'producto_adjuntos';
begin
  execute format('drop policy if exists "leer %1$s" on public.%1$I', t);
  execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "insertar %1$s" on public.%1$I', t);
  execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "borrar %1$s" on public.%1$I', t);
  execute format('create policy "borrar %1$s" on public.%1$I for delete to authenticated using (empresa_id = public.empresa_actual())', t);
end $$;

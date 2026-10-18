-- ============================================================
--  Migracion 023: traslados entre almacenes
--
--  Ejecutar DESPUES de 022_facturacion_electronica.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.traslados (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  producto_id      uuid not null references public.productos(id),
  almacen_origen   uuid not null references public.almacenes(id),
  almacen_destino  uuid not null references public.almacenes(id),
  cantidad         numeric(14,3) not null,
  fecha            timestamptz not null default now(),
  observacion      text,
  usuario_id       uuid,
  created_at       timestamptz not null default now()
);
create index if not exists idx_traslados_empresa on public.traslados(empresa_id, fecha desc);

-- RLS
alter table public.traslados enable row level security;
do $$
declare t text := 'traslados';
begin
  execute format('drop policy if exists "leer %1$s" on public.%1$I', t);
  execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "insertar %1$s" on public.%1$I', t);
  execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', t);
end $$;

-- RPC: registrar traslado (salida en origen + entrada en destino)
create or replace function public.registrar_traslado(
  p_producto       uuid,
  p_almacen_origen uuid,
  p_almacen_destino uuid,
  p_cantidad       numeric,
  p_observacion    text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.empresa_del_usuario();
  v_usuario uuid := auth.uid();
  v_id      uuid;
begin
  if v_empresa is null then raise exception 'Sesion no valida'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  if p_almacen_origen = p_almacen_destino then raise exception 'El almacen de origen y destino deben ser diferentes'; end if;

  -- Salida en origen
  perform public.registrar_movimiento(p_producto, 'salida', p_cantidad::integer, 0,
    'Traslado a otro almacen', null, null, null, p_almacen_origen);
  -- Entrada en destino
  perform public.registrar_movimiento(p_producto, 'entrada', p_cantidad::integer, 0,
    'Traslado desde otro almacen', null, null, null, p_almacen_destino);

  insert into public.traslados (empresa_id, producto_id, almacen_origen, almacen_destino, cantidad, observacion, usuario_id)
  values (v_empresa, p_producto, p_almacen_origen, p_almacen_destino, p_cantidad, p_observacion, v_usuario)
  returning id into v_id;

  return json_build_object('ok', true, 'traslado_id', v_id);
end $$;

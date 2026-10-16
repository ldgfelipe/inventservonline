-- ============================================================
--  Migracion 014: modulo comercial (POS/cobranza + cuentas por pagar)
--
--  Ejecutar DESPUES de 013_planes_freemium.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
--
--  Cubre el flujo completo:
--   - Clientes
--   - Ventas (con detalle) + salida de stock + CxC
--   - Cobros (caja) + aplicacion a CxC (FIFO si no se indica factura)
--   - Compras a proveedores (con detalle) + entrada de stock + CxP
--   - Pagos a proveedores + aplicacion a CxP
--
--  Las operaciones multi-paso se hacen en RPCs transaccionales para
--  que stock, movimiento, cabecera, detalle y cuenta por cobrar/pagar
--  nunca queden a medias.
-- ============================================================

-- ------------------------------------------------------------
--  1. Clientes
-- ------------------------------------------------------------
create table if not exists public.clientes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  nombre         text not null,
  rif            text,
  telefono       text,
  email          text,
  direccion      text,
  limite_credito numeric(14,2) default 0,
  notas          text,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_clientes_empresa on public.clientes(empresa_id);

-- ------------------------------------------------------------
--  2. Ventas
-- ------------------------------------------------------------
create table if not exists public.ventas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  cliente_id  uuid references public.clientes(id) on delete set null,
  numero      text not null,
  fecha       timestamptz not null default now(),
  subtotal    numeric(14,2) not null default 0,
  descuento   numeric(14,2) not null default 0,
  impuesto    numeric(14,2) not null default 0,
  total       numeric(14,2) not null default 0,
  estado      text not null default 'confirmada'
                check (estado in ('borrador','confirmada','anulada')),
  notas       text,
  usuario_id  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ventas_empresa on public.ventas(empresa_id, fecha desc);

create table if not exists public.venta_detalle (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  venta_id        uuid not null references public.ventas(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        numeric(14,3) not null,
  precio_unitario numeric(14,2) not null default 0,
  descuento       numeric(14,2) not null default 0,
  subtotal        numeric(14,2) not null default 0,
  costo_unitario  numeric(14,2) not null default 0,
  almacen_id      uuid references public.almacenes(id) on delete set null
);

-- ------------------------------------------------------------
--  3. Cuentas por cobrar (CxC) y cobros (caja)
-- ------------------------------------------------------------
create table if not exists public.cuentas_por_cobrar (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  venta_id        uuid not null unique references public.ventas(id) on delete cascade,
  cliente_id      uuid references public.clientes(id) on delete set null,
  monto_total     numeric(14,2) not null default 0,
  monto_cobrado   numeric(14,2) not null default 0,
  saldo           numeric(14,2) not null default 0,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','parcial','pagada','vencida','anulada')),
  fecha_vencimiento date,
  updated_at      timestamptz not null default now()
);
create index if not exists idx_cxc_empresa on public.cuentas_por_cobrar(empresa_id, estado);

create table if not exists public.cobros (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  cliente_id  uuid references public.clientes(id) on delete set null,
  venta_id    uuid references public.ventas(id) on delete set null,
  monto       numeric(14,2) not null,
  metodo      text not null default 'efectivo'
                check (metodo in ('efectivo','tarjeta','transferencia','otro')),
  referencia  text,
  fecha       timestamptz not null default now(),
  usuario_id  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_cobros_empresa on public.cobros(empresa_id, fecha desc);

-- ------------------------------------------------------------
--  4. Compras a proveedores
-- ------------------------------------------------------------
create table if not exists public.compras (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  numero      text not null,
  fecha       timestamptz not null default now(),
  subtotal    numeric(14,2) not null default 0,
  impuesto    numeric(14,2) not null default 0,
  total       numeric(14,2) not null default 0,
  estado      text not null default 'recibida'
                check (estado in ('borrador','recibida','anulada')),
  notas       text,
  usuario_id  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_compras_empresa on public.compras(empresa_id, fecha desc);

create table if not exists public.compra_detalle (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  compra_id      uuid not null references public.compras(id) on delete cascade,
  producto_id    uuid not null references public.productos(id),
  cantidad       numeric(14,3) not null,
  costo_unitario numeric(14,2) not null default 0,
  subtotal       numeric(14,2) not null default 0,
  almacen_id     uuid references public.almacenes(id) on delete set null
);

-- ------------------------------------------------------------
--  5. Cuentas por pagar (CxP) y pagos a proveedores
-- ------------------------------------------------------------
create table if not exists public.cuentas_por_pagar (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  compra_id       uuid not null unique references public.compras(id) on delete cascade,
  proveedor_id    uuid references public.proveedores(id) on delete set null,
  monto_total     numeric(14,2) not null default 0,
  monto_pagado    numeric(14,2) not null default 0,
  saldo           numeric(14,2) not null default 0,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','parcial','pagada','anulada')),
  fecha_vencimiento date,
  updated_at      timestamptz not null default now()
);
create index if not exists idx_cxp_empresa on public.cuentas_por_pagar(empresa_id, estado);

create table if not exists public.pagos_proveedor (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  compra_id   uuid references public.compras(id) on delete set null,
  monto       numeric(14,2) not null,
  metodo      text not null default 'transferencia'
                check (metodo in ('efectivo','transferencia','cheque','otro')),
  referencia  text,
  fecha       timestamptz not null default now(),
  usuario_id  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pagos_prov_empresa on public.pagos_proveedor(empresa_id, fecha desc);

-- ------------------------------------------------------------
--  6. RLS (segunda capa de defensa)
-- ------------------------------------------------------------
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'clientes','ventas','venta_detalle','cuentas_por_cobrar','cobros',
    'compras','compra_detalle','cuentas_por_pagar','pagos_proveedor'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);

    execute format('drop policy if exists "leer %1$s" on public.%1$I', tabla);
    execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "insertar %1$s" on public.%1$I', tabla);
    execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "actualizar %1$s" on public.%1$I', tabla);
    execute format('create policy "actualizar %1$s" on public.%1$I for update to authenticated using (empresa_id = public.empresa_actual()) with check (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "borrar %1$s" on public.%1$I', tabla);
    execute format('create policy "borrar %1$s" on public.%1$I for delete to authenticated using (empresa_id = public.empresa_actual())', tabla);
  end loop;
end $$;

-- ------------------------------------------------------------
--  7. RPC: registrar_venta
--     Crea la venta, su detalle, decrementa stock (salida) y la CxC.
-- ------------------------------------------------------------
create or replace function public.registrar_venta(
  p_cliente    uuid default null,
  p_items      jsonb default '[]'::jsonb,
  p_descuento  numeric default 0,
  p_impuesto   numeric default 0,
  p_notas      text default null,
  p_almacen    uuid default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa   uuid := public.empresa_del_usuario();
  v_usuario   uuid := auth.uid();
  v_numero    text;
  v_venta_id  uuid;
  v_subtotal  numeric := 0;
  v_total     numeric := 0;
  v_item      record;
  v_stock     integer;
  v_precio    numeric;
  v_cant      numeric;
  v_desc      numeric;
  v_sub       numeric;
  v_costo     numeric;
begin
  if v_empresa is null then raise exception 'Sesion no valida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  -- Numero correlativo por empresa
  select 'V-' || lpad((count(*) + 1)::text, 6, '0') into v_numero
  from public.ventas where empresa_id = v_empresa;

  -- Validar stock y calcular subtotal
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant   := coalesce((v_item.value->>'cantidad')::numeric, 0);
    v_precio := coalesce((v_item.value->>'precio_unitario')::numeric, 0);
    v_desc   := coalesce((v_item.value->>'descuento')::numeric, 0);
    if v_cant <= 0 then raise exception 'Cantidad invalida'; end if;

    select stock_actual, costo_promedio into v_stock, v_costo
    from public.productos
    where id = (v_item.value->>'producto_id')::uuid and empresa_id = v_empresa
    for update;
    if not found then raise exception 'Producto no encontrado'; end if;
    if v_cant > v_stock then
      raise exception 'Stock insuficiente: hay % y se pidieron %', v_stock, v_cant;
    end if;

    v_sub := round((v_precio * v_cant) - v_desc, 2);
    v_subtotal := v_subtotal + v_sub;
  end loop;

  v_total := round(v_subtotal - coalesce(p_descuento,0) + coalesce(p_impuesto,0), 2);

  -- Cabecera
  insert into public.ventas (empresa_id, cliente_id, numero, subtotal, descuento, impuesto, total, notas, usuario_id)
  values (v_empresa, p_cliente, v_numero, v_subtotal, coalesce(p_descuento,0), coalesce(p_impuesto,0), v_total, p_notas, v_usuario)
  returning id into v_venta_id;

  -- Detalle + salida de stock + movimiento
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant   := coalesce((v_item.value->>'cantidad')::numeric, 0);
    v_precio := coalesce((v_item.value->>'precio_unitario')::numeric, 0);
    v_desc   := coalesce((v_item.value->>'descuento')::numeric, 0);
    v_sub    := round((v_precio * v_cant) - v_desc, 2);

    select costo_promedio into v_costo
    from public.productos where id = (v_item.value->>'producto_id')::uuid;

    insert into public.venta_detalle
      (empresa_id, venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, costo_unitario, almacen_id)
    values
      (v_empresa, v_venta_id, (v_item.value->>'producto_id')::uuid, v_cant, v_precio, v_desc, v_sub, coalesce(v_costo,0), p_almacen);

    -- Salida de stock (reutiliza la logica atomica de registrar_movimiento)
    perform public.registrar_movimiento(
      (v_item.value->>'producto_id')::uuid,
      'salida',
      v_cant::integer,
      v_precio,
      'Venta ' || v_numero,
      null
    );
  end loop;

  -- Cuenta por cobrar
  insert into public.cuentas_por_cobrar (empresa_id, venta_id, cliente_id, monto_total, saldo, estado)
  values (v_empresa, v_venta_id, p_cliente, v_total, v_total, 'pendiente');

  return json_build_object('ok', true, 'venta_id', v_venta_id, 'numero', v_numero, 'total', v_total);
end $$;

-- ------------------------------------------------------------
--  8. RPC: registrar_cobro
-- ------------------------------------------------------------
create or replace function public.registrar_cobro(
  p_cliente    uuid,
  p_venta      uuid default null,
  p_monto      numeric,
  p_metodo     text default 'efectivo',
  p_referencia text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.empresa_del_usuario();
  v_usuario uuid := auth.uid();
  v_cobro   uuid;
  v_restante numeric := p_monto;
  v_cxc     record;
  v_aplicado numeric := 0;
begin
  if v_empresa is null then raise exception 'Sesion no valida'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;

  insert into public.cobros (empresa_id, cliente_id, venta_id, monto, metodo, referencia, usuario_id)
  values (v_empresa, p_cliente, p_venta, p_monto, coalesce(p_metodo,'efectivo'), p_referencia, v_usuario)
  returning id into v_cobro;

  if p_venta is not null then
    update public.cuentas_por_cobrar
    set monto_cobrado = monto_cobrado + p_monto,
        saldo = greatest(0, monto_total - (monto_cobrado + p_monto)),
        estado = case
          when (monto_total - (monto_cobrado + p_monto)) <= 0 then 'pagada'
          else 'parcial'
        end,
        updated_at = now()
    where venta_id = p_venta and empresa_id = v_empresa;
    v_aplicado := p_monto;
  else
    -- Aplicacion FIFO a las CxC pendientes del cliente
    for v_cxc in
      select id, saldo from public.cuentas_por_cobrar
      where empresa_id = v_empresa and cliente_id = p_cliente and estado in ('pendiente','parcial')
      order by created_at
    loop
      exit when v_restante <= 0;
      if v_cxc.saldo <= v_restante then
        update public.cuentas_por_cobrar
        set monto_cobrado = monto_total, saldo = 0, estado = 'pagada', updated_at = now()
        where id = v_cxc.id;
        v_restante := v_restante - v_cxc.saldo;
        v_aplicado := v_aplicado + v_cxc.saldo;
      else
        update public.cuentas_por_cobrar
        set monto_cobrado = monto_cobrado + v_restante,
            saldo = saldo - v_restante,
            estado = 'parcial', updated_at = now()
        where id = v_cxc.id;
        v_aplicado := v_aplicado + v_restante;
        v_restante := 0;
      end if;
    end loop;
  end if;

  return json_build_object('ok', true, 'cobro_id', v_cobro, 'aplicado', v_aplicado);
end $$;

-- ------------------------------------------------------------
--  9. RPC: registrar_compra
-- ------------------------------------------------------------
create or replace function public.registrar_compra(
  p_proveedor  uuid default null,
  p_items      jsonb default '[]'::jsonb,
  p_impuesto   numeric default 0,
  p_notas      text default null,
  p_almacen    uuid default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa    uuid := public.empresa_del_usuario();
  v_usuario    uuid := auth.uid();
  v_numero     text;
  v_compra_id  uuid;
  v_subtotal   numeric := 0;
  v_total      numeric := 0;
  v_item       record;
  v_cant       numeric;
  v_costo      numeric;
  v_sub        numeric;
begin
  if v_empresa is null then raise exception 'Sesion no valida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra debe tener al menos un producto';
  end if;

  select 'C-' || lpad((count(*) + 1)::text, 6, '0') into v_numero
  from public.compras where empresa_id = v_empresa;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant  := coalesce((v_item.value->>'cantidad')::numeric, 0);
    v_costo := coalesce((v_item.value->>'costo_unitario')::numeric, 0);
    if v_cant <= 0 then raise exception 'Cantidad invalida'; end if;
    v_sub := round(v_costo * v_cant, 2);
    v_subtotal := v_subtotal + v_sub;
  end loop;

  v_total := round(v_subtotal + coalesce(p_impuesto,0), 2);

  insert into public.compras (empresa_id, proveedor_id, numero, subtotal, impuesto, total, notas, usuario_id)
  values (v_empresa, p_proveedor, v_numero, v_subtotal, coalesce(p_impuesto,0), v_total, p_notas, v_usuario)
  returning id into v_compra_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant  := coalesce((v_item.value->>'cantidad')::numeric, 0);
    v_costo := coalesce((v_item.value->>'costo_unitario')::numeric, 0);
    v_sub   := round(v_costo * v_cant, 2);

    insert into public.compra_detalle
      (empresa_id, compra_id, producto_id, cantidad, costo_unitario, subtotal, almacen_id)
    values
      (v_empresa, v_compra_id, (v_item.value->>'producto_id')::uuid, v_cant, v_costo, v_sub, p_almacen);

    -- Entrada de stock (reutiliza la logica atomica)
    perform public.registrar_movimiento(
      (v_item.value->>'producto_id')::uuid,
      'entrada',
      v_cant::integer,
      v_costo,
      'Compra ' || v_numero,
      p_proveedor
    );
  end loop;

  -- Cuenta por pagar
  insert into public.cuentas_por_pagar (empresa_id, compra_id, proveedor_id, monto_total, saldo, estado)
  values (v_empresa, v_compra_id, p_proveedor, v_total, v_total, 'pendiente');

  return json_build_object('ok', true, 'compra_id', v_compra_id, 'numero', v_numero, 'total', v_total);
end $$;

-- ------------------------------------------------------------
--  10. RPC: registrar_pago_proveedor
-- ------------------------------------------------------------
create or replace function public.registrar_pago_proveedor(
  p_proveedor  uuid,
  p_compra     uuid default null,
  p_monto      numeric,
  p_metodo     text default 'transferencia',
  p_referencia text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa  uuid := public.empresa_del_usuario();
  v_usuario  uuid := auth.uid();
  v_pago     uuid;
  v_restante numeric := p_monto;
  v_cxp      record;
  v_aplicado numeric := 0;
begin
  if v_empresa is null then raise exception 'Sesion no valida'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;

  insert into public.pagos_proveedor (empresa_id, proveedor_id, compra_id, monto, metodo, referencia, usuario_id)
  values (v_empresa, p_proveedor, p_compra, p_monto, coalesce(p_metodo,'transferencia'), p_referencia, v_usuario)
  returning id into v_pago;

  if p_compra is not null then
    update public.cuentas_por_pagar
    set monto_pagado = monto_pagado + p_monto,
        saldo = greatest(0, monto_total - (monto_pagado + p_monto)),
        estado = case
          when (monto_total - (monto_pagado + p_monto)) <= 0 then 'pagada'
          else 'parcial'
        end,
        updated_at = now()
    where compra_id = p_compra and empresa_id = v_empresa;
    v_aplicado := p_monto;
  else
    for v_cxp in
      select id, saldo from public.cuentas_por_pagar
      where empresa_id = v_empresa and proveedor_id = p_proveedor and estado in ('pendiente','parcial')
      order by created_at
    loop
      exit when v_restante <= 0;
      if v_cxp.saldo <= v_restante then
        update public.cuentas_por_pagar
        set monto_pagado = monto_total, saldo = 0, estado = 'pagada', updated_at = now()
        where id = v_cxp.id;
        v_restante := v_restante - v_cxp.saldo;
        v_aplicado := v_aplicado + v_cxp.saldo;
      else
        update public.cuentas_por_pagar
        set monto_pagado = monto_pagado + v_restante,
            saldo = saldo - v_restante,
            estado = 'parcial', updated_at = now()
        where id = v_cxp.id;
        v_aplicado := v_aplicado + v_restante;
        v_restante := 0;
      end if;
    end loop;
  end if;

  return json_build_object('ok', true, 'pago_id', v_pago, 'aplicado', v_aplicado);
end $$;

-- ------------------------------------------------------------
--  11. Verificacion
-- ------------------------------------------------------------
select 'clientes' as tabla, count(*) from public.clientes
union all select 'ventas', count(*) from public.ventas
union all select 'compras', count(*) from public.compras
union all select 'cxc', count(*) from public.cuentas_por_cobrar
union all select 'cxp', count(*) from public.cuentas_por_pagar;

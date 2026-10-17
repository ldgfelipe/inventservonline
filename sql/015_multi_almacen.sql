-- ============================================================
--  Migracion 015: multi-almacen real
--
--  Ejecutar DESPUES de 014_comercial.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
--
--  - registrar_movimiento acepta p_almacen (default: almacen principal).
--  - Mantiene producto_almacen (desglose de stock por ubicacion).
--  - Registra almacen_id en movimientos.
--  - registrar_venta y registrar_compra propagan p_almacen.
--  - productos.stock_actual sigue siendo el total consolidado.
-- ============================================================

-- ------------------------------------------------------------
--  1. registrar_movimiento (con almacen)
-- ------------------------------------------------------------
create or replace function public.registrar_movimiento(
  p_producto    uuid,
  p_tipo        text,
  p_cantidad    integer,
  p_precio      numeric default 0,
  p_observacion text default null,
  p_proveedor   uuid default null,
  p_concepto    text default null,
  p_documento   text default null,
  p_almacen     uuid default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa     uuid := public.empresa_del_usuario();
  v_usuario     uuid := auth.uid();
  v_stock       integer;
  v_nombre      text;
  v_costo_prom  numeric;
  v_costo_unit  numeric;
  v_costo_total numeric;
  v_total       numeric;
  v_stock_final integer;
  v_saldo       numeric;
  v_almacen     uuid;
begin
  if v_empresa is null then
    raise exception 'Sesion no valida';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  -- Resolver almacen: el indicado o el principal de la empresa.
  if p_almacen is not null then
    v_almacen := p_almacen;
  else
    select id into v_almacen from public.almacenes
    where empresa_id = v_empresa and principal = true limit 1;
  end if;

  select stock_actual, nombre, coalesce(costo_promedio, 0)
    into v_stock, v_nombre, v_costo_prom
  from public.productos
  where id = p_producto and empresa_id = v_empresa
  for update;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  v_total := round(coalesce(p_precio, 0) * p_cantidad, 2);

  if p_tipo = 'entrada' then
    v_stock_final := v_stock + p_cantidad;
    if v_stock_final > 0 then
      v_costo_prom := round(((v_stock * v_costo_prom) + v_total) / v_stock_final, 4);
    else
      v_costo_prom := coalesce(p_precio, 0);
    end if;
    v_costo_unit  := round(coalesce(p_precio, 0), 2);
    v_costo_total := v_total;

    update public.productos
       set stock_actual   = v_stock_final,
           costo_promedio = v_costo_prom,
           precio_compra  = case when coalesce(p_precio, 0) > 0 then p_precio else precio_compra end,
           updated_at     = now()
     where id = p_producto;
  else
    if p_cantidad > v_stock then
      raise exception 'Stock insuficiente: hay % y se pidieron %', v_stock, p_cantidad;
    end if;
    v_stock_final := v_stock - p_cantidad;
    v_costo_unit := round(v_costo_prom, 2);
    if v_costo_unit = 0 then
      select round(coalesce(precio_compra, 0), 2) into v_costo_unit
      from public.productos where id = p_producto;
    end if;
    v_costo_total := round(v_costo_unit * p_cantidad, 2);

    update public.productos
       set stock_actual = v_stock_final, updated_at = now()
     where id = p_producto;
  end if;

  v_saldo := round(v_stock_final * round(coalesce(v_costo_prom, v_costo_unit), 2), 2);

  insert into public.movimientos
    (empresa_id, producto_id, usuario_id, tipo, cantidad, precio_unitario, total,
     costo_unitario, costo_total, stock_resultante, saldo_valor,
     proveedor_id, concepto, documento, observacion, almacen_id)
  values
    (v_empresa, p_producto, v_usuario, p_tipo, p_cantidad, coalesce(p_precio, 0), v_total,
     v_costo_unit, v_costo_total, v_stock_final, v_saldo,
     p_proveedor, p_concepto, p_documento, p_observacion, v_almacen);

  -- Mantener desglose por almacen (si existe la tabla y el almacen).
  if v_almacen is not null then
    insert into public.producto_almacen (empresa_id, producto_id, almacen_id, cantidad)
    values (v_empresa, p_producto, v_almacen, 0)
    on conflict (producto_id, almacen_id) do nothing;

    if p_tipo = 'entrada' then
      update public.producto_almacen
         set cantidad = cantidad + p_cantidad, updated_at = now()
       where producto_id = p_producto and almacen_id = v_almacen;
    else
      update public.producto_almacen
         set cantidad = greatest(0, cantidad - p_cantidad), updated_at = now()
       where producto_id = p_producto and almacen_id = v_almacen;
    end if;
  end if;

  return json_build_object(
    'stock_actual',   v_stock_final,
    'nombre',         v_nombre,
    'total',          v_total,
    'costo_unitario', v_costo_unit,
    'costo_total',    v_costo_total,
    'costo_promedio', round(coalesce(v_costo_prom, 0), 2),
    'saldo_valor',    v_saldo,
    'almacen_id',     v_almacen
  );
end $$;

-- ------------------------------------------------------------
--  2. registrar_venta: propagar p_almacen
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

  select 'V-' || lpad((count(*) + 1)::text, 6, '0') into v_numero
  from public.ventas where empresa_id = v_empresa;

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

  insert into public.ventas (empresa_id, cliente_id, numero, subtotal, descuento, impuesto, total, notas, usuario_id)
  values (v_empresa, p_cliente, v_numero, v_subtotal, coalesce(p_descuento,0), coalesce(p_impuesto,0), v_total, p_notas, v_usuario)
  returning id into v_venta_id;

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

    perform public.registrar_movimiento(
      (v_item.value->>'producto_id')::uuid,
      'salida',
      v_cant::integer,
      v_precio,
      'Venta ' || v_numero,
      null,
      null,
      null,
      p_almacen
    );
  end loop;

  insert into public.cuentas_por_cobrar (empresa_id, venta_id, cliente_id, monto_total, saldo, estado)
  values (v_empresa, v_venta_id, p_cliente, v_total, v_total, 'pendiente');

  return json_build_object('ok', true, 'venta_id', v_venta_id, 'numero', v_numero, 'total', v_total);
end $$;

-- ------------------------------------------------------------
--  3. registrar_compra: propagar p_almacen
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

    perform public.registrar_movimiento(
      (v_item.value->>'producto_id')::uuid,
      'entrada',
      v_cant::integer,
      v_costo,
      'Compra ' || v_numero,
      p_proveedor,
      null,
      null,
      p_almacen
    );
  end loop;

  insert into public.cuentas_por_pagar (empresa_id, compra_id, proveedor_id, monto_total, saldo, estado)
  values (v_empresa, v_compra_id, p_proveedor, v_total, v_total, 'pendiente');

  return json_build_object('ok', true, 'compra_id', v_compra_id, 'numero', v_numero, 'total', v_total);
end $$;

-- ------------------------------------------------------------
--  4. Verificacion
-- ------------------------------------------------------------
select 'producto_almacen' as tabla, count(*) from public.producto_almacen
union all select 'movimientos con almacen', count(*) from public.movimientos where almacen_id is not null;

-- ============================================================
--  Migracion 010: almacen (maximos/minimos/reorden) y contabilidad
--
--  Objetivo:
--   * Alertas de stock: agotado, bajo, por reordenar y sobre-stock.
--   * Buenas practicas de almacenaje: unidad, punto de reorden,
--     lote y fecha de vencimiento por producto.
--   * Kardex valorizado con COSTO PROMEDIO PONDERADO: cada entrada
--     recalcula el costo promedio y cada salida se valoriza a ese
--     costo (costo de lo vendido).
--
--  Idempotente: se puede ejecutar varias veces sin duplicar nada.
-- ============================================================

-- 1. Productos: campos de almacen y costo promedio ----------
alter table public.productos add column if not exists punto_reorden    integer not null default 0;
alter table public.productos add column if not exists unidad           text not null default 'unidad';
alter table public.productos add column if not exists lote             text;
alter table public.productos add column if not exists fecha_vencimiento date;
alter table public.productos add column if not exists costo_promedio   numeric(14,2) not null default 0;

-- Los productos que ya existian parten con su costo de compra como promedio.
update public.productos
   set costo_promedio = precio_compra
 where costo_promedio = 0 and precio_compra > 0;

-- 2. Movimientos: valorizacion, concepto y documento --------
alter table public.movimientos add column if not exists concepto        text;
alter table public.movimientos add column if not exists documento       text;
alter table public.movimientos add column if not exists costo_unitario  numeric(14,2) not null default 0;
alter table public.movimientos add column if not exists costo_total     numeric(14,2) not null default 0;
alter table public.movimientos add column if not exists stock_resultante integer;
alter table public.movimientos add column if not exists saldo_valor     numeric(14,2) not null default 0;

-- A los movimientos viejos les faltaba el costo: usamos su propio precio.
update public.movimientos
   set costo_unitario = precio_unitario,
       costo_total    = total
 where costo_unitario = 0 and precio_unitario > 0;

create index if not exists idx_movimientos_empresa_fecha on public.movimientos(empresa_id, fecha desc);

-- 3. Movimiento de stock atomico y valorizado ---------------
--    Al agregar parametros con default al final, las llamadas
--    existentes siguen funcionando sin cambios.
create or replace function public.registrar_movimiento(
  p_producto    uuid,
  p_tipo        text,
  p_cantidad    integer,
  p_precio      numeric default 0,
  p_observacion text default null,
  p_proveedor   uuid default null,
  p_concepto    text default null,
  p_documento   text default null
)
returns json
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
begin
  if v_empresa is null then
    raise exception 'Sesion no valida';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
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
    -- Costo promedio ponderado: (valor que habia + valor que entra) / unidades.
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
    -- La salida se valoriza al costo promedio vigente (costo de lo vendido).
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
     proveedor_id, concepto, documento, observacion)
  values
    (v_empresa, p_producto, v_usuario, p_tipo, p_cantidad, coalesce(p_precio, 0), v_total,
     v_costo_unit, v_costo_total, v_stock_final, v_saldo,
     p_proveedor, p_concepto, p_documento, p_observacion);

  return json_build_object(
    'stock_actual',   v_stock_final,
    'nombre',         v_nombre,
    'total',          v_total,
    'costo_unitario', v_costo_unit,
    'costo_total',    v_costo_total,
    'costo_promedio', round(coalesce(v_costo_prom, 0), 2),
    'saldo_valor',    v_saldo
  );
end $$;

-- 4. Dashboard: nuevas alertas y valor a costo ---------------
create or replace function public.metricas_dashboard()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'productos', (select count(*) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo),
    'unidades',  (select coalesce(sum(stock_actual), 0) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo),
    'valor',     (select coalesce(sum(stock_actual * precio_venta), 0) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo),
    'valorCosto',(select coalesce(sum(stock_actual * costo_promedio), 0) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo),
    'stockBajo', (select count(*) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo
                    and stock_actual > 0 and stock_actual <= stock_minimo),
    'porReordenar', (select count(*) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo
                    and punto_reorden > 0 and stock_actual > 0 and stock_actual <= punto_reorden),
    'stockExceso', (select count(*) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo
                    and stock_maximo > 0 and stock_actual > stock_maximo),
    'agotados',  (select count(*) from public.productos
                  where empresa_id = public.empresa_del_usuario() and activo and stock_actual <= 0),
    'movimientosHoy', (select count(*) from public.movimientos
                  where empresa_id = public.empresa_del_usuario() and fecha >= current_date),
    'usuarios',  (select count(*) from public.perfiles
                  where empresa_id = public.empresa_del_usuario() and activo)
  );
$$;

-- 5. Resumen contable + kardex -------------------------------
create or replace function public.metricas_contables(
  p_desde date default (current_date - 29),
  p_hasta date default current_date
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with emp as (select public.empresa_del_usuario() as id),
  inv as (
    select
      count(*) filter (where p.activo)                                        as productos,
      coalesce(sum(p.stock_actual) filter (where p.activo), 0)               as unidades,
      coalesce(sum(p.stock_actual * p.costo_promedio) filter (where p.activo), 0) as valor_costo,
      coalesce(sum(p.stock_actual * p.precio_venta) filter (where p.activo), 0)   as valor_venta,
      count(*) filter (where p.activo and p.stock_actual <= 0)               as agotados,
      count(*) filter (where p.activo and p.stock_maximo > 0 and p.stock_actual > p.stock_maximo) as exceso,
      count(*) filter (where p.activo and p.punto_reorden > 0
                            and p.stock_actual > 0 and p.stock_actual <= p.punto_reorden) as reorden
    from public.productos p, emp
    where p.empresa_id = emp.id
  ),
  mov as (
    select
      coalesce(sum(m.costo_total) filter (where m.tipo = 'entrada'), 0) as entradas_costo,
      coalesce(sum(m.cantidad)    filter (where m.tipo = 'entrada'), 0) as entradas_unidades,
      coalesce(sum(m.costo_total) filter (where m.tipo = 'salida'), 0)  as salidas_costo,
      coalesce(sum(m.total)       filter (where m.tipo = 'salida'), 0)  as salidas_venta,
      coalesce(sum(m.cantidad)    filter (where m.tipo = 'salida'), 0)  as salidas_unidades
    from public.movimientos m, emp
    where m.empresa_id = emp.id
      and m.fecha::date between p_desde and p_hasta
  )
  select json_build_object(
    'desde',            p_desde,
    'hasta',            p_hasta,
    'productos',        inv.productos,
    'unidades',         inv.unidades,
    'valorCosto',       inv.valor_costo,
    'valorVenta',       inv.valor_venta,
    'agotados',         inv.agotados,
    'exceso',           inv.exceso,
    'reorden',          inv.reorden,
    'entradasCosto',    mov.entradas_costo,
    'entradasUnidades', mov.entradas_unidades,
    'salidasCosto',     mov.salidas_costo,
    'salidasVenta',     mov.salidas_venta,
    'salidasUnidades',  mov.salidas_unidades,
    'margen',           (mov.salidas_venta - mov.salidas_costo),
    'utilidadInventario', (inv.valor_venta - inv.valor_costo)
  )
  from inv, mov;
$$;

-- 6. Resumen contable por categoria (para el informe) -------
create or replace function public.contabilidad_por_categoria()
returns table (categoria text, productos bigint, unidades bigint, valor_costo numeric, valor_venta numeric)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.nombre, 'Sin categoria') as categoria,
         count(p.id)                                  as productos,
         coalesce(sum(p.stock_actual), 0)             as unidades,
         coalesce(sum(p.stock_actual * p.costo_promedio), 0) as valor_costo,
         coalesce(sum(p.stock_actual * p.precio_venta), 0)   as valor_venta
  from public.productos p
  left join public.categorias c on c.id = p.categoria_id
  where p.empresa_id = public.empresa_del_usuario() and p.activo
  group by coalesce(c.nombre, 'Sin categoria')
  order by valor_costo desc;
$$;

-- ============================================================
--  Migracion 011: mejora del demo de abarrotes
--
--  Depende de 009 (crea la empresa demo) y de 010 (columnas de
--  almacen y contabilidad). Si la empresa demo no existe, no hace
--  nada: es seguro ejecutarla en cualquier orden despues de 009.
--
--  Agrega: proveedores, maximos/punto de reorden/unidad, costo
--  promedio y un historial de entradas y salidas para que la
--  trazabilidad, las alertas y el kardex muestren datos reales.
--  Idempotente.
-- ============================================================

do $$
declare
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_prov_abar  uuid;
  v_prov_limp  uuid;
  r            record;
  v_entrada    integer;
  v_salida     integer;
begin
  select id into v_empresa_id from public.empresas where email = 'demo@abarrotes.com';
  select id into v_usuario_id from auth.users where email = 'demo@abarrotes.com';
  if v_empresa_id is null then
    raise notice 'Demo abarrotes no existe (ejecuta 009 primero). Nada que hacer.';
    return;
  end if;

  -- 1. Proveedores demo -------------------------------------
  select id into v_prov_abar from public.proveedores
   where empresa_id = v_empresa_id and nombre = 'Distribuidora La Cosecha';
  if v_prov_abar is null then
    insert into public.proveedores (empresa_id, nombre, rif, telefono, email, direccion)
    values (v_empresa_id, 'Distribuidora La Cosecha', 'J-30123456-7', '0212-555-1010',
            'ventas@lacosecha.com', 'Av. Principal, Galpon 4, Caracas')
    returning id into v_prov_abar;
  end if;

  select id into v_prov_limp from public.proveedores
   where empresa_id = v_empresa_id and nombre = 'Limpieza Total C.A.';
  if v_prov_limp is null then
    insert into public.proveedores (empresa_id, nombre, rif, telefono, email, direccion)
    values (v_empresa_id, 'Limpieza Total C.A.', 'J-40987654-3', '0212-555-2020',
            'pedidos@limpiezatotal.com', 'Zona Industrial, Galpon 12, Valencia')
    returning id into v_prov_limp;
  end if;

  -- 2. Almacen + costo promedio + proveedor por producto ----
  update public.productos p
     set stock_maximo   = greatest(coalesce(nullif(p.stock_maximo, 0), 0), p.stock_actual + 60),
         punto_reorden  = greatest(coalesce(nullif(p.punto_reorden, 0), 0),
                                   greatest(ceil(p.stock_actual * 0.25)::int, 5)),
         unidad         = coalesce(nullif(p.unidad, ''), 'unidad'),
         costo_promedio = case when p.costo_promedio = 0 then p.precio_compra else p.costo_promedio end,
         proveedor_id   = case
                            when coalesce(c.nombre, '') = 'Abarrotes' then v_prov_abar
                            else v_prov_limp
                          end
    from public.categorias c
   where p.empresa_id = v_empresa_id
     and p.categoria_id = c.id;

  -- 2b. Casos que demuestran cada tipo de alerta --------------
  -- Exceso: stock por encima del maximo.
  update public.productos set stock_maximo = 120
   where empresa_id = v_empresa_id and codigo = 'AB001';
  -- Bajo minimo: queda por debajo del minimo.
  update public.productos set stock_minimo = 30, stock_actual = 12
   where empresa_id = v_empresa_id and codigo = 'AB005';
  -- Agotado: sin existencias.
  update public.productos set stock_actual = 0
   where empresa_id = v_empresa_id and codigo = 'BB002';
  -- Por reordenar: bajo el punto de reorden pero sobre el minimo.
  update public.productos set punto_reorden = 100, stock_minimo = 10
   where empresa_id = v_empresa_id and codigo = 'LP003';

  -- 3. Historial de movimientos (entrada + salida) ----------
  --    Entrada = stock_actual + 20 y salida = 20, de modo que el
  --    saldo final coincide con el stock_actual del producto.
  for r in
    select id, stock_actual, precio_compra, precio_venta
      from public.productos
     where empresa_id = v_empresa_id
  loop
    if not exists (select 1 from public.movimientos
                    where empresa_id = v_empresa_id and producto_id = r.id) then
      v_entrada := r.stock_actual + 20;
      v_salida  := 20;

      insert into public.movimientos
        (empresa_id, producto_id, usuario_id, tipo, cantidad, precio_unitario, total,
         costo_unitario, costo_total, stock_resultante, saldo_valor,
         concepto, documento, observacion, fecha)
      values
        (v_empresa_id, r.id, v_usuario_id, 'entrada', v_entrada, r.precio_compra,
         round(r.precio_compra * v_entrada, 2),
         r.precio_compra, round(r.precio_compra * v_entrada, 2),
         v_entrada, round(r.precio_compra * v_entrada, 2),
         'Compra a proveedor', 'FAC-DEMO-0001', 'Carga inicial del demo',
         now() - interval '15 days');

      insert into public.movimientos
        (empresa_id, producto_id, usuario_id, tipo, cantidad, precio_unitario, total,
         costo_unitario, costo_total, stock_resultante, saldo_valor,
         concepto, documento, observacion, fecha)
      values
        (v_empresa_id, r.id, v_usuario_id, 'salida', v_salida, r.precio_venta,
         round(r.precio_venta * v_salida, 2),
         r.precio_compra, round(r.precio_compra * v_salida, 2),
         r.stock_actual, round(r.precio_compra * r.stock_actual, 2),
         'Venta al detal', 'TICKET-DEMO-0001', 'Ventas del periodo',
         now() - interval '3 days');
    end if;
  end loop;

  -- Responsable de los movimientos ya existentes (011 corrio antes de esto).
  if v_usuario_id is not null then
    update public.movimientos
       set usuario_id = v_usuario_id
     where empresa_id = v_empresa_id and usuario_id is null;
  end if;

  raise notice 'Demo abarrotes ampliado correctamente';
end $$;

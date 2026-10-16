-- ============================================================
--  Demo: Tienda de Abarrotes La Esquina
--  Cuenta demo: demo@abarrotes.com / demo123456
--  Empresa: Abarrotes La Esquina (plan trial, giro Supermercado y abastos)
--  Idempotente: no crea duplicados si ya existe
-- ============================================================

do $$
declare
  v_usuario_id uuid;
  v_empresa_id uuid;
  v_giro_id    integer;
  v_cat_abar   uuid;
  v_cat_lim    uuid;
  v_cat_beb    uuid;
  v_cat_pan    uuid;
begin
  -- 1. Usuario demo (idempotente)
  select id into v_usuario_id from auth.users where email = 'demo@abarrotes.com';
  if v_usuario_id is null then
    v_usuario_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_usuario_id, 'authenticated', 'authenticated',
      'demo@abarrotes.com',
      extensions.crypt('demo123456', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_usuario_id, v_usuario_id,
      jsonb_build_object('sub', v_usuario_id::text, 'email', 'demo@abarrotes.com',
                         'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  end if;

  -- 2. Giro
  select id into v_giro_id from public.giros where nombre = 'Supermercado y abastos';
  if v_giro_id is null then
    insert into public.giros (nombre) values ('Supermercado y abastos') returning id into v_giro_id;
  end if;

  -- 3. Empresa demo (idempotente)
  select id into v_empresa_id from public.empresas where email = 'demo@abarrotes.com';
  if v_empresa_id is null then
    v_empresa_id := gen_random_uuid();
    insert into public.empresas (id, nombre, email, giro_actual, plan)
    values (v_empresa_id, 'Abarrotes La Esquina', 'demo@abarrotes.com', 'Supermercado y abastos', 'trial');
  else
    update public.empresas
    set nombre = 'Abarrotes La Esquina', giro_actual = 'Supermercado y abastos', plan = 'trial'
    where id = v_empresa_id;
  end if;

  -- 4. Perfil (admin de la empresa demo, no super_admin)
  insert into public.perfiles (id, empresa_id, nombre, rol, area, super_admin)
  values (v_usuario_id, v_empresa_id, 'Demo Abarrotes', 'admin', 'Administracion', false)
  on conflict (id) do update
    set empresa_id = excluded.empresa_id,
        nombre     = excluded.nombre,
        rol        = excluded.rol,
        area       = excluded.area,
        super_admin= false;

  -- 5. Categorias
  insert into public.categorias (empresa_id, nombre) values (v_empresa_id, 'Abarrotes')   on conflict do nothing;
  insert into public.categorias (empresa_id, nombre) values (v_empresa_id, 'Limpieza')    on conflict do nothing;
  insert into public.categorias (empresa_id, nombre) values (v_empresa_id, 'Bebidas')     on conflict do nothing;
  insert into public.categorias (empresa_id, nombre) values (v_empresa_id, 'Panaderia')   on conflict do nothing;
  insert into public.categorias (empresa_id, nombre) values (v_empresa_id, 'General')     on conflict do nothing;

  select id into v_cat_abar from public.categorias where empresa_id = v_empresa_id and nombre = 'Abarrotes';
  select id into v_cat_lim  from public.categorias where empresa_id = v_empresa_id and nombre = 'Limpieza';
  select id into v_cat_beb  from public.categorias where empresa_id = v_empresa_id and nombre = 'Bebidas';
  select id into v_cat_pan  from public.categorias where empresa_id = v_empresa_id and nombre = 'Panaderia';

  -- 6. Productos (15)
  insert into public.productos (empresa_id, codigo, nombre, categoria_id, stock_minimo, stock_actual, precio_compra, precio_venta, ubicacion)
  values
    (v_empresa_id, 'AB001', 'Arroz blanco 1Kg', v_cat_abar, 10, 150, 1.80, 2.50, 'Estante A1'),
    (v_empresa_id, 'AB002', 'Frijoles negros 1Kg', v_cat_abar, 10, 120, 2.20, 3.00, 'Estante A1'),
    (v_empresa_id, 'AB003', 'Aceite de maiz 1L', v_cat_abar, 5, 80, 3.50, 4.80, 'Estante A2'),
    (v_empresa_id, 'AB004', 'Azucar blanca 1Kg', v_cat_abar, 10, 200, 1.40, 2.00, 'Estante A2'),
    (v_empresa_id, 'AB005', 'Cafe molido 250g', v_cat_abar, 8, 60, 2.80, 4.00, 'Estante A3'),
    (v_empresa_id, 'AB006', 'Leche en polvo 400g', v_cat_abar, 6, 70, 3.20, 4.50, 'Estante A3'),
    (v_empresa_id, 'AB007', 'Harina de maiz 1Kg', v_cat_abar, 10, 150, 1.60, 2.20, 'Estante A1'),
    (v_empresa_id, 'AB008', 'Salsa de tomate 500g', v_cat_abar, 8, 90, 1.70, 2.40, 'Estante A4'),
    (v_empresa_id, 'AB009', 'Atun en lata 170g', v_cat_abar, 12, 110, 2.00, 2.90, 'Estante A4'),
    (v_empresa_id, 'AB010', 'Pasta corta 500g', v_cat_abar, 10, 140, 1.50, 2.10, 'Estante A4'),
    (v_empresa_id, 'LP001', 'Detergente liquido 1L', v_cat_lim, 5, 50, 3.00, 4.20, 'Estante L1'),
    (v_empresa_id, 'LP002', 'Jabon de tocador 90g', v_cat_lim, 12, 150, 0.90, 1.40, 'Estante L1'),
    (v_empresa_id, 'LP003', 'Papel higienico 4 rollos', v_cat_lim, 8, 80, 2.40, 3.50, 'Estante L2'),
    (v_empresa_id, 'BB001', 'Gaseosa 2L', v_cat_beb, 10, 95, 1.90, 2.80, 'Nevera/Bebidas'),
    (v_empresa_id, 'BB002', 'Cerveza lata 355ml x6', v_cat_beb, 6, 40, 7.50, 10.50, 'Nevera/Bebidas')
  on conflict (empresa_id, codigo) do update
    set nombre = excluded.nombre,
        categoria_id = excluded.categoria_id,
        stock_minimo = excluded.stock_minimo,
        stock_actual = excluded.stock_actual,
        precio_compra = excluded.precio_compra,
        precio_venta  = excluded.precio_venta,
        ubicacion     = excluded.ubicacion,
        activo        = true;

  raise notice 'Demo Abarrotes creado/actualizado correctamente';
end $$;

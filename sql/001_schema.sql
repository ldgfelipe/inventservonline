-- ============================================================
--  Sistema de Inventarios ONLINE - esquema multi-inquilino
--  Ejecutar UNA vez en: Supabase Dashboard -> SQL Editor
--
--  Modelo: cada registro pertenece a una EMPRESA (inquilino).
--  El aislamiento NO se hace en el codigo de la aplicacion, sino
--  con Row Level Security en la base de datos: aunque una ruta se
--  equivoque, un usuario jamas puede leer datos de otra empresa.
-- ============================================================

-- Empresas (inquilinos) -------------------------------
create table if not exists public.empresas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  rif         text,
  email       text,
  giro_actual text not null default 'Construccion',
  plan        text not null default 'trial',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Perfiles: un usuario de auth.users pertenece a UNA empresa.
-- El primer usuario que se registra es administrador de la suya.
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'admin',
  area       text not null default 'Administracion',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_perfiles_empresa on public.perfiles(empresa_id);

-- Empresa del usuario autenticado (usada por todas las policies) ---
create or replace function public.empresa_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.perfiles where id = auth.uid()
$$;

-- Catálogo compartido (solo lectura para los usuarios) --------
create table if not exists public.giros (
  id     serial primary key,
  nombre text not null unique,
  activo boolean not null default true
);

create table if not exists public.campos_giro (
  id          serial primary key,
  giro_id     integer not null references public.giros(id) on delete cascade,
  nombre      text not null,
  tipo        text not null,
  obligatorio boolean not null default false
);

insert into public.giros (nombre) values ('Construccion'), ('Farmacia')
  on conflict (nombre) do nothing;

insert into public.campos_giro (giro_id, nombre, tipo, obligatorio)
select g.id, c.nombre, c.tipo, c.obligatorio
from public.giros g
cross join (values
  ('material', 'text', true),
  ('espesor', 'text', false),
  ('proveedor_material', 'text', false)
) as c(nombre, tipo, obligatorio)
where g.nombre = 'Construccion'
  and not exists (select 1 from public.campos_giro cg where cg.giro_id = g.id);

insert into public.campos_giro (giro_id, nombre, tipo, obligatorio)
select g.id, c.nombre, c.tipo, c.obligatorio
from public.giros g
cross join (values
  ('principio_activo', 'text', true),
  ('lote', 'text', true),
  ('fecha_vencimiento', 'date', true),
  ('requiere_receta', 'integer', false)
) as c(nombre, tipo, obligatorio)
where g.nombre = 'Farmacia'
  and not exists (select 1 from public.campos_giro cg where cg.giro_id = g.id);

-- Datos del negocio (aislados por empresa) ---------------------
create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre     text not null
);

create table if not exists public.proveedores (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre     text not null,
  rif         text,
  telefono    text,
  email       text,
  direccion   text,
  activo      boolean not null default true
);

create table if not exists public.productos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  codigo        text,
  nombre        text not null,
  categoria_id  uuid references public.categorias(id) on delete set null,
  proveedor_id  uuid references public.proveedores(id) on delete set null,
  stock_minimo  integer not null default 0,
  stock_maximo  integer not null default 0,
  stock_actual  integer not null default 0,
  precio_compra numeric(14,2) not null default 0,
  precio_venta  numeric(14,2) not null default 0,
  ubicacion     text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Un codigo no puede repetirse dentro de la misma empresa
create unique index if not exists uq_productos_empresa_codigo
  on public.productos(empresa_id, codigo) where codigo is not null;

create table if not exists public.valores_campos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  campo_id    integer not null references public.campos_giro(id) on delete cascade,
  valor       text,
  unique (producto_id, campo_id)
);

create table if not exists public.movimientos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  producto_id    uuid not null references public.productos(id) on delete cascade,
  usuario_id     uuid,
  tipo           text not null check (tipo in ('entrada', 'salida')),
  cantidad       integer not null,
  precio_unitario numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  proveedor_id   uuid references public.proveedores(id) on delete set null,
  observacion    text,
  fecha          timestamptz not null default now()
);

create table if not exists public.configuracion (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  clave      text not null,
  valor      text,
  primary key (empresa_id, clave)
);

create table if not exists public.asistente_alias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  usuario_id  uuid,
  frase       text not null,
  producto_id uuid not null references public.productos(id) on delete cascade,
  usado       timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.bitacora (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid,
  usuario    text,
  area       text,
  rol        text,
  accion     text not null,
  entidad    text,
  entidad_id text,
  detalle    text,
  fecha      timestamptz not null default now()
);

create table if not exists public.eventos_app (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid,
  usuario    text,
  area       text,
  rol        text,
  evento     text not null,
  contexto   text,
  fecha      timestamptz not null default now()
);

create index if not exists idx_movimientos_producto on public.movimientos(producto_id);
create index if not exists idx_movimientos_fecha    on public.movimientos(fecha);
create index if not exists idx_productos_empresa     on public.productos(empresa_id);
create index if not exists idx_bitacora_fecha        on public.bitacora(fecha);

-- ============================================================
--  Productos mas movidos (lo usa el asistente)
-- ============================================================
create or replace function public.top_movidos(p_empresa uuid, p_limite integer default 10)
returns table (nombre text, movimientos bigint, entradas bigint, salidas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.nombre,
         count(m.id) as movimientos,
         count(m.id) filter (where m.tipo = 'entrada') as entradas,
         count(m.id) filter (where m.tipo = 'salida') as salidas
  from public.movimientos m
  join public.productos p on p.id = m.producto_id
  where m.empresa_id = p_empresa
  group by p.id, p.nombre
  order by movimientos desc
  limit p_limite;
$$;

-- ============================================================
--  Metricas de adopcion (detectar abandono de un cliente)
-- ============================================================
create or replace function public.metricas_adopcion(p_empresa uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with claves as (
    select unnest(array[
      'producto.crear', 'movimiento.entrada', 'movimiento.salida',
      'reporte.exportar', 'importacion.aplicar', 'asistente.consulta'
    ]) as evento
  ),
  hechos as (
    select c.evento,
           exists (select 1 from public.eventos_app e
                   where e.empresa_id = p_empresa and e.evento = c.evento) as hecho
    from claves c
  )
  select json_build_object(
    'dias7',       (select count(distinct fecha::date) from public.eventos_app
                    where empresa_id = p_empresa and fecha >= current_date - 6),
    'dias30',      (select count(distinct fecha::date) from public.eventos_app
                    where empresa_id = p_empresa and fecha >= current_date - 29),
    'totalEventos',(select count(*) from public.eventos_app where empresa_id = p_empresa),
    'asistente',   (select count(*) from public.eventos_app
                    where empresa_id = p_empresa and evento = 'asistente.consulta'),
    'hoy',         (select count(*) from public.eventos_app
                    where empresa_id = p_empresa and fecha >= current_date),
    'usuariosActivos', (select count(distinct usuario_id) from public.eventos_app
                    where empresa_id = p_empresa and usuario_id is not null),
    'completado',  (select json_agg(json_build_object('evento', evento, 'hecho', hecho)) from hechos)
  );
$$;

-- ============================================================
--  Metricas del dashboard (agregadas en SQL)
-- ============================================================
create or replace function public.metricas_dashboard(p_empresa uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'productos', (select count(*) from public.productos where empresa_id = p_empresa and activo),
    'unidades',  (select coalesce(sum(stock_actual), 0) from public.productos where empresa_id = p_empresa and activo),
    'valor',     (select coalesce(sum(stock_actual * precio_venta), 0) from public.productos where empresa_id = p_empresa and activo),
    'stockBajo', (select count(*) from public.productos where empresa_id = p_empresa and activo and stock_actual > 0 and stock_actual <= stock_minimo),
    'agotados',  (select count(*) from public.productos where empresa_id = p_empresa and activo and stock_actual <= 0),
    'movimientosHoy', (select count(*) from public.movimientos where empresa_id = p_empresa and fecha >= current_date),
    'usuarios',  (select count(*) from public.perfiles where empresa_id = p_empresa and activo)
  );
$$;

-- ============================================================
--  Movimiento de stock atomico
--
--  Actualiza el stock e inserta el movimiento en una sola transaccion.
--  Es una funcion de Postgres (no dos consultas desde la API) para que
--  no pueda quedar el stock actualizado sin movimiento, o al reves.
-- ============================================================
create or replace function public.registrar_movimiento(
  p_empresa    uuid,
  p_producto   uuid,
  p_usuario    uuid,
  p_tipo       text,
  p_cantidad   integer,
  p_precio     numeric,
  p_observacion text,
  p_proveedor  uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_nombre text;
  v_total numeric;
begin
  select stock_actual, nombre into v_stock, v_nombre
  from public.productos
  where id = p_producto and empresa_id = p_empresa
  for update;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if p_tipo = 'entrada' then
    v_stock := v_stock + p_cantidad;
  else
    if p_cantidad > v_stock then
      raise exception 'Stock insuficiente: hay % y se pidieron %', v_stock, p_cantidad;
    end if;
    v_stock := v_stock - p_cantidad;
  end if;

  v_total := round(p_precio * p_cantidad, 2);

  update public.productos
  set stock_actual = v_stock, updated_at = now()
  where id = p_producto;

  insert into public.movimientos
    (empresa_id, producto_id, usuario_id, tipo, cantidad, precio_unitario, total, proveedor_id, observacion)
  values
    (p_empresa, p_producto, p_usuario, p_tipo, p_cantidad, p_precio, v_total, p_proveedor, p_observacion);

  return json_build_object('stock_actual', v_stock, 'nombre', v_nombre, 'total', v_total);
end $$;

-- ============================================================
--  Row Level Security
--  Regla: cada usuario ve y escribe solo filas de SU empresa.
-- ============================================================

alter table public.empresas        enable row level security;
alter table public.perfiles        enable row level security;
alter table public.categorias      enable row level security;
alter table public.proveedores     enable row level security;
alter table public.productos       enable row level security;
alter table public.valores_campos  enable row level security;
alter table public.movimientos     enable row level security;
alter table public.configuracion   enable row level security;
alter table public.asistente_alias enable row level security;
alter table public.bitacora        enable row level security;
alter table public.eventos_app     enable row level security;

-- Empresa: solo la propia
drop policy if exists "empresa propia" on public.empresas;
create policy "empresa propia" on public.empresas
  for select using (id = public.empresa_actual());

drop policy if exists "empresa actualizar propia" on public.empresas;
create policy "empresa actualizar propia" on public.empresas
  for update using (id = public.empresa_actual());

-- Perfiles: los de mi empresa (el registro inicial lo hace el servidor
-- con service_role, que salta RLS)
drop policy if exists "perfiles de mi empresa" on public.perfiles;
create policy "perfiles de mi empresa" on public.perfiles
  for select using (empresa_id = public.empresa_actual());

drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
  for select using (id = auth.uid());

-- Catalogo compartido: lectura para cualquier usuario autenticado
drop policy if exists "giros lectura" on public.giros;
create policy "giros lectura" on public.giros
  for select to authenticated using (true);

drop policy if exists "campos lectura" on public.campos_giro;
create policy "campos lectura" on public.campos_giro
  for select to authenticated using (true);

-- Politicas genericas para las tablas de datos de la empresa
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'categorias','proveedores','productos','valores_campos',
    'movimientos','configuracion','asistente_alias','bitacora','eventos_app'
  ]
  loop
    execute format('drop policy if exists "leer %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "leer %1$s" on public.%1$I for select using (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "insertar %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "insertar %1$s" on public.%1$I for insert with check (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "actualizar %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "actualizar %1$s" on public.%1$I for update using (empresa_id = public.empresa_actual())', tabla);

    execute format('drop policy if exists "borrar %1$s" on public.%1$I', tabla);
    execute format(
      'create policy "borrar %1$s" on public.%1$I for delete using (empresa_id = public.empresa_actual())', tabla);
  end loop;
end $$;

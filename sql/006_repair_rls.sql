-- ============================================================
--  REPARACION DEL RLS (Row Level Security)
--
--  Ejecuta esto si el login dice "Tu perfil existe pero las politicas
--  de seguridad impiden leerlo".
--
--  Recrea las funciones y TODAS las policies desde cero. Es idempotente:
--  se puede ejecutar las veces que haga falta.
--
--  Sintoma tipico: la seccion de RLS de 001_schema.sql (que esta al
--  final del archivo) no llego a ejecutarse, asi que las tablas tienen
--  RLS activado pero sin policies, y Postgres deniega todo por defecto.
-- ============================================================

-- ---------- Funciones base ----------
create or replace function public.empresa_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.perfiles where id = auth.uid()
$$;

create or replace function public.empresa_del_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.perfiles where id = auth.uid()
$$;

-- ---------- RLS activo en todas las tablas ----------
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
alter table public.claves_admin    enable row level security;

-- ---------- PERFILES (la que te esta bloqueando) ----------
-- Esta es la politica clave: cada usuario lee SU propia fila.
drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "perfiles de mi empresa" on public.perfiles;
create policy "perfiles de mi empresa" on public.perfiles
  for select to authenticated
  using (empresa_id = public.empresa_actual());

drop policy if exists "perfil actualizar propio" on public.perfiles;
create policy "perfil actualizar propio" on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- EMPRESAS ----------
drop policy if exists "empresa propia" on public.empresas;
create policy "empresa propia" on public.empresas
  for select to authenticated
  using (id = public.empresa_actual());

drop policy if exists "empresa actualizar propia" on public.empresas;
create policy "empresa actualizar propia" on public.empresas
  for update to authenticated
  using (id = public.empresa_actual())
  with check (id = public.empresa_actual());

-- ---------- TABLAS DE DATOS DE LA EMPRESA ----------
-- Cada una con sus cuatro operaciones. Se generan en bucle para no
-- repetir el mismo bloque nueve veces.
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

-- ---------- CATALOGO COMPARTIDO (solo lectura) ----------
drop policy if exists "giros lectura" on public.giros;
create policy "giros lectura" on public.giros
  for select to authenticated using (true);

drop policy if exists "campos lectura" on public.campos_giro;
create policy "campos lectura" on public.campos_giro
  for select to authenticated using (true);

-- ---------- VERIFICACION ----------
-- Debe devolver al menos "perfil propio" en la lista.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'perfiles'
order by policyname;

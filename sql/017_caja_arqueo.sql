-- ============================================================
--  Migracion 017: cierre de caja / arqueo
--
--  Ejecutar DESPUES de 016_facturacion_iva.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.caja_sesiones (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  usuario_id            uuid,
  fecha_apertura        timestamptz not null default now(),
  fecha_cierre          timestamptz,
  monto_inicial         numeric(14,2) not null default 0,
  monto_final_esperado  numeric(14,2),
  monto_final_real      numeric(14,2),
  diferencia            numeric(14,2),
  estado                text not null default 'abierta'
                          check (estado in ('abierta','cerrada')),
  notas                 text,
  created_at            timestamptz not null default now()
);
create index if not exists idx_caja_sesiones_empresa on public.caja_sesiones(empresa_id, fecha_apertura desc);

-- RLS
alter table public.caja_sesiones enable row level security;
do $$
declare t text := 'caja_sesiones';
begin
  execute format('drop policy if exists "leer %1$s" on public.%1$I', t);
  execute format('create policy "leer %1$s" on public.%1$I for select to authenticated using (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "insertar %1$s" on public.%1$I', t);
  execute format('create policy "insertar %1$s" on public.%1$I for insert to authenticated with check (empresa_id = public.empresa_actual())', t);
  execute format('drop policy if exists "actualizar %1$s" on public.%1$I', t);
  execute format('create policy "actualizar %1$s" on public.%1$I for update to authenticated using (empresa_id = public.empresa_actual()) with check (empresa_id = public.empresa_actual())', t);
end $$;

-- RPC: abrir caja
create or replace function public.abrir_caja(p_monto_inicial numeric default 0)
returns json
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
  -- Si ya hay una caja abierta, no abrir otra
  if exists (select 1 from public.caja_sesiones where empresa_id = v_empresa and estado = 'abierta') then
    raise exception 'Ya hay una caja abierta. Cierrala primero.';
  end if;
  insert into public.caja_sesiones (empresa_id, usuario_id, monto_inicial, estado)
  values (v_empresa, v_usuario, coalesce(p_monto_inicial, 0), 'abierta')
  returning id into v_id;
  return json_build_object('ok', true, 'sesion_id', v_id, 'monto_inicial', coalesce(p_monto_inicial, 0));
end $$;

-- RPC: cerrar caja (calcula esperado = inicial + cobros del periodo)
create or replace function public.cerrar_caja(p_sesion_id uuid, p_monto_real numeric, p_notas text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa  uuid := public.empresa_del_usuario();
  v_sesion   record;
  v_cobros   numeric := 0;
  v_esperado numeric;
  v_dif      numeric;
begin
  if v_empresa is null then raise exception 'Sesion no valida'; end if;
  select * into v_sesion from public.caja_sesiones
  where id = p_sesion_id and empresa_id = v_empresa and estado = 'abierta';
  if not found then raise exception 'Sesion de caja no encontrada o ya cerrada'; end if;

  select coalesce(sum(monto), 0) into v_cobros
  from public.cobros
  where empresa_id = v_empresa and fecha >= v_sesion.fecha_apertura
    and (v_sesion.fecha_cierre is null or fecha <= now());

  v_esperado := v_sesion.monto_inicial + v_cobros;
  v_dif := round(coalesce(p_monto_real, 0) - v_esperado, 2);

  update public.caja_sesiones
  set fecha_cierre = now(),
      monto_final_esperado = v_esperado,
      monto_final_real = coalesce(p_monto_real, 0),
      diferencia = v_dif,
      estado = 'cerrada',
      notas = coalesce(p_notas, notas)
  where id = p_sesion_id;

  return json_build_object('ok', true, 'esperado', v_esperado, 'real', coalesce(p_monto_real, 0),
    'diferencia', v_dif, 'cobros', v_cobros);
end $$;

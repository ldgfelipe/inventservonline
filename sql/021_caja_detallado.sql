-- ============================================================
--  Migracion 021: cierre de caja detallado (arqueo por metodo)
--
--  Ejecutar DESPUES de 020_whatsapp_config.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

-- Agregar columna para el desglose por metodo (JSON) en caja_sesiones
alter table public.caja_sesiones
  add column if not exists desglose_esperado jsonb,
  add column if not exists desglose_real jsonb;

-- RPC: cerrar caja detallado (calcula esperado por metodo)
create or replace function public.cerrar_caja_detallado(
  p_sesion_id    uuid,
  p_monto_real   numeric,
  p_desglose_real jsonb default null,
  p_notas        text default null
) returns json
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
  v_desglose jsonb;
begin
  if v_empresa is null then raise exception 'Sesion no valida'; end if;
  select * into v_sesion from public.caja_sesiones
  where id = p_sesion_id and empresa_id = v_empresa and estado = 'abierta';
  if not found then raise exception 'Sesion de caja no encontrada o ya cerrada'; end if;

  -- Total de cobros del periodo
  select coalesce(sum(monto), 0) into v_cobros
  from public.cobros
  where empresa_id = v_empresa and fecha >= v_sesion.fecha_apertura;

  v_esperado := v_sesion.monto_inicial + v_cobros;
  v_dif := round(coalesce(p_monto_real, 0) - v_esperado, 2);

  -- Desglose esperado por metodo
  select coalesce(jsonb_object_agg(metodo, total), '{}'::jsonb) into v_desglose
  from (
    select metodo, coalesce(sum(monto), 0) as total
    from public.cobros
    where empresa_id = v_empresa and fecha >= v_sesion.fecha_apertura
    group by metodo
  ) t;

  -- Agregar monto inicial al efectivo esperado
  v_desglose := jsonb_set(v_desglose, '{efectivo}',
    to_jsonb(coalesce((v_desglose->>'efectivo')::numeric, 0) + v_sesion.monto_inicial));

  update public.caja_sesiones
  set fecha_cierre = now(),
      monto_final_esperado = v_esperado,
      monto_final_real = coalesce(p_monto_real, 0),
      diferencia = v_dif,
      estado = 'cerrada',
      notas = coalesce(p_notas, notas),
      desglose_esperado = v_desglose,
      desglose_real = p_desglose_real
  where id = p_sesion_id;

  return json_build_object('ok', true, 'esperado', v_esperado, 'real', coalesce(p_monto_real, 0),
    'diferencia', v_dif, 'cobros', v_cobros, 'desglose_esperado', v_desglose);
end $$;

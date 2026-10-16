-- ============================================================
--  Migracion 012: pais y moneda de la empresa
--
--  Cada empresa (inquilino) elige su pais y la moneda con la que
--  el sistema MUESTRA los importes (dashboard, contabilidad,
--  comprobantes, informes).
--
--  IMPORTANTE: solo cambia la presentacion. Los valores guardados
--  en productos y movimientos NO se convierten ni se reescriben.
--
--  Idempotente: se puede correr varias veces sin problema.
-- ============================================================

alter table public.empresas
  add column if not exists pais   text not null default 'VE',
  add column if not exists moneda text not null default 'VES';

comment on column public.empresas.pais   is 'Codigo ISO del pais (VE, CO, MX, ...). Migracion 012.';
comment on column public.empresas.moneda is 'Codigo ISO de la moneda para mostrar importes (VES, USD, ...). Migracion 012.';

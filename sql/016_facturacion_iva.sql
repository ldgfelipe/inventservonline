-- ============================================================
--  Migracion 016: tasa de IVA por empresa (facturacion)
--
--  Ejecutar DESPUES de 015_multi_almacen.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

alter table public.empresas
  add column if not exists tasa_iva numeric(5,2) not null default 0;

-- Compatibilidad: columnas de empresas usadas por el panel de facturacion.
-- (No se agregan mas; tasa_iva es la unica nueva.)

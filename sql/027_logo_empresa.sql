-- ============================================================
--  Migracion 027: logo de empresa (ruta en storage)
--
--  Ejecutar DESPUES de 026_storage_archivos.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

alter table public.empresas
  add column if not exists logo_path text;

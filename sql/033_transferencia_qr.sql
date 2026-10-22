-- ============================================================
--  Migracion 033: QR / imagen para transferencia bancaria
--
--  Ejecutar DESPUES de 032_config_pagos.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

alter table public.configuracion_pagos
  add column if not exists transferencia_qr_url text;

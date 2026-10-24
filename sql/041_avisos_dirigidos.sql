-- ============================================================
--  Migracion 041: avisos dirigidos a areas o usuarios
--
--  Permite que el asistente (o cualquier usuario) envie avisos a un
--  area (Almacen, Compras, Ventas, ...) o a un usuario concreto.
--  Si ambos campos son null, el aviso es para toda la empresa.
--
--  Ejecutar DESPUES de 040_bajas_email.sql.
--  Idempotente.
-- ============================================================

alter table if exists public.notificaciones
  add column if not exists destino_area text,
  add column if not exists destino_usuario uuid,
  add column if not exists autor_id uuid,
  add column if not exists autor_nombre text;

create index if not exists idx_notif_destino
  on public.notificaciones(empresa_id, destino_area, destino_usuario);

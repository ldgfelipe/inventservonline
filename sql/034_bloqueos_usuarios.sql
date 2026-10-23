-- ============================================================
--  Migracion 034: historial de bloqueos de usuarios
--
--  Ejecutar DESPUES de 033_transferencia_qr.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

create table if not exists public.usuarios_bloqueos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null,
  empresa_id    uuid references public.empresas(id) on delete cascade,
  accion        text not null check (accion in ('bloqueo','desbloqueo')),
  motivo        text,
  realizado_por uuid,
  realizado_por_nombre text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_bloqueos_usuario on public.usuarios_bloqueos(usuario_id, created_at desc);

alter table public.usuarios_bloqueos enable row level security;

drop policy if exists "superadmin lee bloqueos" on public.usuarios_bloqueos;
create policy "superadmin lee bloqueos" on public.usuarios_bloqueos
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "superadmin inserta bloqueos" on public.usuarios_bloqueos;
create policy "superadmin inserta bloqueos" on public.usuarios_bloqueos
  for insert to authenticated
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

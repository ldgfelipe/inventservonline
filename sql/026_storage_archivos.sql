-- ============================================================
--  Migracion 026: Storage de archivos (Supabase Storage)
--
--  Ejecutar DESPUES de 025_asistente_almacen.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
--
--  Crea el bucket 'archivos' (privado) y las policies RLS para que
--  cada empresa solo acceda a su carpeta: empresas/{empresa_id}/...
-- ============================================================

-- Bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archivos', 'archivos', false, 52428800, array['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Policies RLS sobre storage.objects para el bucket 'archivos'.
-- La ruta debe empezar con "empresas/{empresa_id}/".

-- Lectura: solo mi empresa
drop policy if exists "leer archivos de mi empresa" on storage.objects;
create policy "leer archivos de mi empresa" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = 'empresas'
    and (storage.foldername(name))[2] = public.empresa_actual()::text
  );

-- Subida: solo mi empresa, en mi carpeta
drop policy if exists "subir archivos de mi empresa" on storage.objects;
create policy "subir archivos de mi empresa" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = 'empresas'
    and (storage.foldername(name))[2] = public.empresa_actual()::text
  );

-- Actualizacion: solo mi empresa
drop policy if exists "actualizar archivos de mi empresa" on storage.objects;
create policy "actualizar archivos de mi empresa" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = 'empresas'
    and (storage.foldername(name))[2] = public.empresa_actual()::text
  );

-- Borrado: solo mi empresa
drop policy if exists "borrar archivos de mi empresa" on storage.objects;
create policy "borrar archivos de mi empresa" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = 'empresas'
    and (storage.foldername(name))[2] = public.empresa_actual()::text
  );

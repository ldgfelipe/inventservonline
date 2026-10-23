/* ============================================================
   Almacenamiento de archivos en Supabase Storage (servidor).
   Usa el cliente de service_role para subir/borrar; el RLS de
   storage.objects queda como segunda capa de defensa.
   ============================================================ */

import { admin } from '@/lib/supabase';

const BUCKET = 'archivos';

/* Sube un archivo (Buffer) a la ruta indicada. Devuelve la ruta. */
export async function subirArchivo(ruta, buffer, contentType) {
  const sb = admin();
  const { data, error } = await sb.storage.from(BUCKET).upload(ruta, buffer, {
    contentType: contentType || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return data.path;
}

/* Genera una URL firmada (temporal) para descargar un archivo privado. */
export async function urlFirmada(ruta, segundos = 3600) {
  const sb = admin();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(ruta, segundos);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/* Borra un archivo. */
export async function borrarArchivo(ruta) {
  const sb = admin();
  const { error } = await sb.storage.from(BUCKET).remove([ruta]);
  if (error) throw new Error(error.message);
}

/* Calcula el uso de storage de una empresa (en bytes) recorriendo su carpeta. */
export async function usoStorage(empresaId) {
  const sb = admin();
  const prefijo = `empresas/${empresaId}`;
  let total = 0;
  async function recorrer(pref) {
    const { data, error } = await sb.storage.from(BUCKET).list(pref, { limit: 1000 });
    if (error || !data) return;
    for (const item of data) {
      if (item.id) {
        // Es un archivo
        total += item.metadata ? (item.metadata.size || 0) : 0;
      } else {
        // Es una carpeta
        await recorrer(`${pref}/${item.name}`);
      }
    }
  }
  await recorrer(prefijo);
  return total;
}

/* Calcula el uso TOTAL de storage de toda la plataforma (en bytes). */
export async function usoStorageTotal() {
  const sb = admin();
  let total = 0;
  async function recorrer(pref) {
    const { data, error } = await sb.storage.from(BUCKET).list(pref, { limit: 1000 });
    if (error || !data) return;
    for (const item of data) {
      if (item.id) {
        total += item.metadata ? (item.metadata.size || 0) : 0;
      } else {
        await recorrer(`${pref}/${item.name}`);
      }
    }
  }
  await recorrer('empresas');
  return total;
}

export { BUCKET };

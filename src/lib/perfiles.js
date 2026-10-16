/* movimientos.usuario_id es un uuid SIN clave foranea hacia perfiles
   (solo apunta a auth.users), por lo que PostgREST no puede embeberlo
   con "perfiles(...)": intentarlo devuelve el error

     Could not find a relationship between 'movimientos' and 'perfiles'

   Los nombres del responsable se resuelven entonces con UNA sola
   consulta por los usuario_id distintos. Asi la trazabilidad y la
   lista de movimientos siguen mostrando "quien hizo que" sin depender
   de una FK que no existe en el esquema. */
export async function mapaPerfiles(sb, ids) {
  const limpios = [...new Set((ids || []).filter(Boolean))];
  if (!limpios.length) return {};
  const { data } = await sb
    .from('perfiles')
    .select('id, nombre, area, rol')
    .in('id', limpios);
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

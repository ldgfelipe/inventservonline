import { PAISES, opcionesMoneda } from '@/lib/monedas';

export const runtime = 'nodejs';

/* GET /api/monedas -> catalogo compartido de paises y monedas.

   Es informacion de referencia (no pertenece a ninguna empresa), asi
   que es publica: la pagina de registro la necesita antes de que
   exista una sesion para poder ofrecer pais y tipo de moneda. */
export async function GET() {
  return Response.json({
    ok: true,
    paises: PAISES,
    monedas: opcionesMoneda(),
  });
}

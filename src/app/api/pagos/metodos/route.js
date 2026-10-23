import { sesion, manejar } from '@/lib/auth';
import { leerConfigPagos, metodosDisponibles, datosTransferencia } from '@/lib/pagos-config';

export const runtime = 'nodejs';

/* GET /api/pagos/metodos
   Devuelve que medios de pago estan habilitados y configurados por el
   super-admin. El panel del cliente solo muestra los disponibles. */
async function listar(request) {
  await sesion(request);
  const config = await leerConfigPagos();
  return Response.json({
    ok: true,
    metodos: metodosDisponibles(config),
    transferencia: datosTransferencia(config),
  });
}

export const GET = manejar(listar);

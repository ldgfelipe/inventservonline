import { sesion, manejar } from '@/lib/auth';
import { leerConfigPagos, datosTransferencia } from '@/lib/pagos-config';

export const runtime = 'nodejs';

/* GET /api/pagos/transferencia-datos -> datos bancarios para transferencia */
async function datos(request) {
  await sesion(request);
  const config = await leerConfigPagos();
  return Response.json({ ok: true, datos: datosTransferencia(config) });
}

export const GET = manejar(datos);

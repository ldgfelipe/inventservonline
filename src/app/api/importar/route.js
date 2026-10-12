import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';
import { analizar } from '@/services/analisisImportacion';
import { parsearCSV, leerXlsxBuffer } from '@/services/importadorWeb';

export const runtime = 'nodejs';

/* POST /api/importar { nombre, contenido(base64) }
   Analiza el archivo SIN aplicarlo: mapea columnas, normaliza numeros,
   detecta duplicados y sugiere codigos y categorias. */
async function analisis(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'productos.crear');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }
  if (!cuerpo.contenido) return error('Falta el contenido del archivo');

  const buffer = Buffer.from(cuerpo.contenido, 'base64');
  const nombre = String(cuerpo.nombre || 'archivo.csv');
  const extension = nombre.split('.').pop().toLowerCase();

  let datos;
  try {
    if (extension === 'xlsx' || extension === 'xlsm') datos = leerXlsxBuffer(buffer);
    else datos = parsearCSV(buffer.toString('utf8'));
  } catch (err) {
    return error('No se pudo leer el archivo: ' + err.message);
  }

  const [{ data: productos }, { data: categorias }] = await Promise.all([
    sb.from('productos').select('id, codigo, nombre, stock_actual').eq('empresa_id', perfil.empresa_id),
    sb.from('categorias').select('id, nombre').eq('empresa_id', perfil.empresa_id),
  ]);

  const plan = analizar(datos, { productos: productos || [], categorias: categorias || [] });

  await auditar(sb, perfil, {
    accion: 'importacion.previsualizar', entidad: 'importacion', detalle: `${nombre}: ${plan.resumen.total} filas`,
  });

  return Response.json({ ok: true, nombreArchivo: nombre, ...plan });
}

export const POST = manejar(analisis);

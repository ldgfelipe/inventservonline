import { error, sesion, exigir, auditar, manejar } from '@/lib/auth';

export const runtime = 'nodejs';

/* POST /api/export { filas, columnas, nombreArchivo, hoja }
   Genera el xlsx en el servidor y lo devuelve en base64; el navegador
   lo descarga. El formato es el mismo que en la version de escritorio. */
async function exportar(request) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'reportes.exportar');

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return error('Cuerpo JSON invalido'); }

  const filas = Array.isArray(cuerpo.filas) ? cuerpo.filas : [];
  const columnas = Array.isArray(cuerpo.columnas) ? cuerpo.columnas : [];
  if (!columnas.length) return error('No hay columnas para exportar');

  const ExcelJS = require('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema de Inventarios (online)';
  const hoja = libro.addWorksheet(cuerpo.hoja || 'Inventario');
  hoja.columns = columnas.map((c) => ({ header: c.titulo, key: c.campo, width: c.ancho || 20 }));
  hoja.addRows(filas);
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: filas.length, column: columnas.length } };

  const buffer = await libro.xlsx.writeBuffer();
  const archivo = cuerpo.nombreArchivo || 'export.xlsx';

  await auditar(sb, perfil, { accion: 'reporte.exportar', entidad: 'reporte', detalle: archivo });

  return Response.json({
    ok: true,
    archivo,
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    contenido: buffer.toString('base64'),
  });
}

export const POST = manejar(exportar);

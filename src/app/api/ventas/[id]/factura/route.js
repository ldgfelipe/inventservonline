import { error, sesion, exigir, manejar } from '@/lib/auth';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';

/* GET /api/ventas/[id]/factura -> PDF de la factura */
async function generar(request, { params }) {
  const { perfil, sb } = await sesion(request);
  exigir(perfil, 'ventas.ver');
  const id = params.id;

  const { data: venta } = await sb.from('ventas')
    .select('*, clientes(nombre, rif, telefono, direccion), empresas(nombre, rif, tasa_iva)')
    .eq('empresa_id', perfil.empresa_id).eq('id', id).maybeSingle();
  if (!venta) return error('Venta no encontrada', 404);

  const { data: detalle } = await sb.from('venta_detalle')
    .select('*, productos(nombre, codigo)').eq('empresa_id', perfil.empresa_id).eq('venta_id', id);

  const emp = venta.empresas || {};
  const tasa = Number(emp.tasa_iva) || 0;
  const subtotal = Number(venta.subtotal) || 0;
  const iva = Math.round(subtotal * tasa / 100 * 100) / 100;

  // Generar PDF en memoria
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const fin = new Promise((resolve) => doc.on('end', resolve));

  doc.fontSize(16).text('FACTURA', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Numero: ${venta.numero}`);
  doc.text(`Fecha: ${new Date(venta.fecha).toLocaleString('es-VE')}`);
  doc.text(`Empresa: ${emp.nombre || ''}`);
  if (emp.rif) doc.text(`RIF: ${emp.rif}`);
  doc.moveDown(0.5);
  doc.text(`Cliente: ${venta.clientes ? venta.clientes.nombre : 'Mostrador'}`);
  if (venta.clientes && venta.clientes.rif) doc.text(`RIF: ${venta.clientes.rif}`);
  if (venta.clientes && venta.clientes.telefono) doc.text(`Tel: ${venta.clientes.telefono}`);
  doc.moveDown(0.5);

  // Tabla
  const y0 = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('Producto', 40, y0);
  doc.text('Cant', 300, y0);
  doc.text('Precio', 360, y0);
  doc.text('Subtotal', 440, y0);
  doc.font('Helvetica');
  let y = y0 + 16;
  for (const d of detalle || []) {
    doc.text((d.productos ? d.productos.nombre : '-') + (d.productos && d.productos.codigo ? ' (' + d.productos.codigo + ')' : ''), 40, y, { width: 250 });
    doc.text(String(d.cantidad), 300, y);
    doc.text(formatoPdf(d.precio_unitario), 360, y);
    doc.text(formatoPdf(d.subtotal), 440, y);
    y += 16;
  }
  doc.moveDown(1);
  doc.text(`Subtotal: ${formatoPdf(subtotal)}`, { align: 'right' });
  doc.text(`Descuento: ${formatoPdf(venta.descuento || 0)}`, { align: 'right' });
  doc.text(`IVA (${tasa}%): ${formatoPdf(iva)}`, { align: 'right' });
  doc.font('Helvetica-Bold').text(`Total: ${formatoPdf(venta.total)}`, { align: 'right' });

  if (venta.notas) {
    doc.moveDown(0.5);
    doc.font('Helvetica').text(`Notas: ${venta.notas}`);
  }

  doc.end();
  await fin;

  const buffer = Buffer.concat(chunks);
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="factura-${venta.numero}.pdf"`,
    },
  });
}

function formatoPdf(n) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
}

export const GET = manejar(generar);

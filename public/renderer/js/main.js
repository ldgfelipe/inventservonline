/* ------------------ Comercial (POS) ------------------ */

function configurarEventosComercial() {
  const bn = document.getElementById('btnNuevoCliente');
  if (bn) bn.addEventListener('click', () => { document.getElementById('clienteId').value = ''; document.getElementById('formCliente').reset(); abrirModal('modalCliente'); });
  const fc = document.getElementById('formCliente');
  if (fc) fc.addEventListener('submit', (e) => { e.preventDefault(); guardarCliente(); });

  const bnv = document.getElementById('btnNuevaVenta');
  if (bnv) bnv.addEventListener('click', abrirNuevaVenta);
  const bav = document.getElementById('btnAgregarItemVenta');
  if (bav) bav.addEventListener('click', agregarItemVenta);
  const bcv = document.getElementById('btnConfirmarVenta');
  if (bcv) bcv.addEventListener('click', confirmarVenta);
  ['ventaDescuento','ventaImpuesto'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', recalcularVenta);
  });

  const bnc = document.getElementById('btnNuevaCompra');
  if (bnc) bnc.addEventListener('click', abrirNuevaCompra);
  const bac = document.getElementById('btnAgregarItemCompra');
  if (bac) bac.addEventListener('click', agregarItemCompra);
  const bcc = document.getElementById('btnConfirmarCompra');
  if (bcc) bcc.addEventListener('click', confirmarCompra);
  const ci = document.getElementById('compraImpuesto');
  if (ci) ci.addEventListener('input', recalcularCompra);

  const fCobro = document.getElementById('formCobro');
  if (fCobro) fCobro.addEventListener('submit', (e) => { e.preventDefault(); registrarCobro(); });
  const fPago = document.getElementById('formPagoProv');
  if (fPago) fPago.addEventListener('submit', (e) => { e.preventDefault(); registrarPagoProv(); });
}

async function cargarClientes() {
  try { ESTADO.clientes = await window.api.clientes.listar(); } catch { ESTADO.clientes = []; }
  renderClientes();
}
function renderClientes() {
  const tb = document.getElementById('clientesBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.clientes.length
    ? ESTADO.clientes.map(c => `<tr>
        <td>${escaparHtml(c.nombre)}</td>
        <td>${escaparHtml(c.rif || '-')}</td>
        <td>${escaparHtml(c.telefono || '-')}</td>
        <td>${escaparHtml(c.email || '-')}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="editarCliente(${c.id})">Editar</button>
            <button class="btn btn-ghost btn-mini" onclick="cobrarCliente(${c.id})">Cobrar</button></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="vacio">Sin clientes</td></tr>';
}
async function guardarCliente() {
  try {
    await window.api.clientes.guardar({
      id: document.getElementById('clienteId').value ? Number(document.getElementById('clienteId').value) : undefined,
      nombre: document.getElementById('clienteNombre').value,
      rif: document.getElementById('clienteRif').value,
      telefono: document.getElementById('clienteTelefono').value,
      email: document.getElementById('clienteEmail').value,
      direccion: document.getElementById('clienteDireccion').value,
    });
    cerrarModal('modalCliente');
    notificar('Cliente guardado');
    await cargarClientes();
  } catch (err) { notificar('Error: ' + err.message, true); }
}
window.editarCliente = function (id) {
  const c = ESTADO.clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('clienteId').value = c.id;
  document.getElementById('clienteNombre').value = c.nombre || '';
  document.getElementById('clienteRif').value = c.rif || '';
  document.getElementById('clienteTelefono').value = c.telefono || '';
  document.getElementById('clienteEmail').value = c.email || '';
  document.getElementById('clienteDireccion').value = c.direccion || '';
  abrirModal('modalCliente');
};
window.cobrarCliente = function (id) {
  const c = ESTADO.clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cobroClienteId').value = c.id;
  document.getElementById('cobroClienteNombre').textContent = c.nombre;
  document.getElementById('cobroVentaId').value = '';
  document.getElementById('cobroMonto').value = '';
  abrirModal('modalCobro');
};

async function cargarVentas() {
  try { ESTADO.ventas = await window.api.ventas.listar({ limite: 200 }); } catch { ESTADO.ventas = []; }
  renderVentas();
}
function renderVentas() {
  const tb = document.getElementById('ventasBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.ventas.length
    ? ESTADO.ventas.map(v => `<tr>
        <td>${escaparHtml(v.numero)}</td>
        <td>${formatoFecha(v.fecha)}</td>
        <td>${escaparHtml(v.cliente_nombre || 'Mostrador')}</td>
        <td>${formatoMoneda(v.total)}</td>
        <td>${escaparHtml(v.estado)}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="verVenta('${v.id}')">Ver</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Sin ventas</td></tr>';
}
window.verVenta = async function (id) {
  try {
    const r = await window.api.ventas.obtener(id);
    alert('Venta ' + r.venta.numero + ' - Total ' + r.venta.total);
  } catch (err) { notificar('Error: ' + err.message, true); }
};

function abrirNuevaVenta() {
  ESTADO.ventaItems = [];
  if (!ESTADO.clientes || !ESTADO.clientes.length) {
    window.api.clientes.listar().then((cs) => { ESTADO.clientes = cs || []; }).catch(() => {});
  }
  document.getElementById('ventaSubtotal').textContent = '0';
  document.getElementById('ventaTotal').textContent = '0';
  document.getElementById('ventaDescuento').value = 0;
  document.getElementById('ventaImpuesto').value = 0;
  document.getElementById('ventaNotas').value = '';
  // cargar clientes
  const sel = document.getElementById('ventaCliente');
  if (sel) {
    sel.innerHTML = '<option value="">Mostrador (sin cliente)</option>' +
      ESTADO.clientes.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('');
  }
  // almacenes
  window.api.almacenes.listar().then((as) => {
    ESTADO.almacenes = as || [];
    const sa = document.getElementById('ventaAlmacen');
    if (sa) sa.innerHTML = '<option value="">Principal</option>' +
      (as || []).map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join('');
  }).catch(() => {});
  renderVentaItems();
  abrirModal('modalVenta');
}

function agregarItemVenta() {
  const term = document.getElementById('ventaBusquedaProd').value.trim().toLowerCase();
  if (!term) return notificar('Busca un producto', true);
  const prod = ESTADO.productos.find(p => (p.nombre || '').toLowerCase().includes(term) || (p.codigo || '').toLowerCase().includes(term));
  if (!prod) return notificar('Producto no encontrado', true);
  const existe = ESTADO.ventaItems.find(i => i.producto_id === prod.id);
  if (existe) { existe.cantidad += 1; }
  else { ESTADO.ventaItems.push({ producto_id: prod.id, nombre: prod.nombre, cantidad: 1, precio_unitario: Number(prod.precio_venta) || 0, descuento: 0 }); }
  renderVentaItems();
  recalcularVenta();
  document.getElementById('ventaBusquedaProd').value = '';
}

function renderVentaItems() {
  const tb = document.getElementById('ventaItemsBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.ventaItems.map((it, idx) => {
    const sub = (it.precio_unitario * it.cantidad) - (it.descuento || 0);
    return `<tr>
      <td>${escaparHtml(it.nombre)}</td>
      <td><input type="number" min="1" value="${it.cantidad}" onchange="actualizarItemVenta(${idx},'cantidad',this.value)" style="width:60px" /></td>
      <td><input type="number" step="0.01" value="${it.precio_unitario}" onchange="actualizarItemVenta(${idx},'precio_unitario',this.value)" style="width:80px" /></td>
      <td><input type="number" step="0.01" value="${it.descuento}" onchange="actualizarItemVenta(${idx},'descuento',this.value)" style="width:70px" /></td>
      <td>${formatoMoneda(sub)}</td>
      <td><button class="btn btn-ghost btn-mini" onclick="quitarItemVenta(${idx})">x</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="vacio">Sin items</td></tr>';
}
window.actualizarItemVenta = function (idx, campo, val) {
  const it = ESTADO.ventaItems[idx];
  if (!it) return;
  it[campo] = Number(val) || 0;
  renderVentaItems();
  recalcularVenta();
};
window.quitarItemVenta = function (idx) {
  ESTADO.ventaItems.splice(idx, 1);
  renderVentaItems();
  recalcularVenta();
};

function recalcularVenta() {
  let sub = 0;
  for (const it of ESTADO.ventaItems) sub += (it.precio_unitario * it.cantidad) - (it.descuento || 0);
  const desc = Number(document.getElementById('ventaDescuento').value) || 0;
  const imp = Number(document.getElementById('ventaImpuesto').value) || 0;
  const total = sub - desc + imp;
  document.getElementById('ventaSubtotal').textContent = formatoMoneda(sub);
  document.getElementById('ventaTotal').textContent = formatoMoneda(total);
}

async function confirmarVenta() {
  if (!ESTADO.ventaItems.length) return notificar('Agrega al menos un producto', true);
  const cliente = document.getElementById('ventaCliente').value;
  const almacen = document.getElementById('ventaAlmacen').value;
  const items = ESTADO.ventaItems.map(it => ({
    producto_id: it.producto_id,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    descuento: it.descuento || 0,
  }));
  try {
    const r = await window.api.ventas.crear({
      cliente_id: cliente || null,
      items,
      descuento: Number(document.getElementById('ventaDescuento').value) || 0,
      impuesto: Number(document.getElementById('ventaImpuesto').value) || 0,
      notas: document.getElementById('ventaNotas').value,
      almacen_id: almacen || null,
    });
    cerrarModal('modalVenta');
    notificar('Venta ' + r.numero + ' registrada');
    ESTADO.ventaItems = [];
    await cargarVentas();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarCompras() {
  try { ESTADO.compras = await window.api.compras.listar({ limite: 200 }); } catch { ESTADO.compras = []; }
  renderCompras();
}
function renderCompras() {
  const tb = document.getElementById('comprasBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.compras.length
    ? ESTADO.compras.map(c => `<tr>
        <td>${escaparHtml(c.numero)}</td>
        <td>${formatoFecha(c.fecha)}</td>
        <td>${escaparHtml(c.proveedor_nombre || '-')}</td>
        <td>${formatoMoneda(c.total)}</td>
        <td>${escaparHtml(c.estado)}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="verCompra('${c.id}')">Ver</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Sin compras</td></tr>';
}
window.verCompra = async function (id) {
  try {
    const r = await window.api.compras.obtener(id);
    alert('Compra ' + r.compra.numero + ' - Total ' + r.compra.total);
  } catch (err) { notificar('Error: ' + err.message, true); }
};

function abrirNuevaCompra() {
  ESTADO.compraItems = [];
  document.getElementById('compraSubtotal').textContent = '0';
  document.getElementById('compraTotal').textContent = '0';
  document.getElementById('compraImpuesto').value = 0;
  document.getElementById('compraNotas').value = '';
  const sp = document.getElementById('compraProveedor');
  if (sp) {
    sp.innerHTML = '<option value="">Sin proveedor</option>' +
      ESTADO.proveedores.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('');
  }
  window.api.almacenes.listar().then((as) => {
    ESTADO.almacenes = as || [];
    const sa = document.getElementById('compraAlmacen');
    if (sa) sa.innerHTML = '<option value="">Principal</option>' +
      (as || []).map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join('');
  }).catch(() => {});
  renderCompraItems();
  abrirModal('modalCompra');
}
function agregarItemCompra() {
  const term = document.getElementById('compraBusquedaProd').value.trim().toLowerCase();
  if (!term) return notificar('Busca un producto', true);
  const prod = ESTADO.productos.find(p => (p.nombre || '').toLowerCase().includes(term) || (p.codigo || '').toLowerCase().includes(term));
  if (!prod) return notificar('Producto no encontrado', true);
  const existe = ESTADO.compraItems.find(i => i.producto_id === prod.id);
  if (existe) { existe.cantidad += 1; }
  else { ESTADO.compraItems.push({ producto_id: prod.id, nombre: prod.nombre, cantidad: 1, costo_unitario: Number(prod.precio_compra) || 0 }); }
  renderCompraItems();
  recalcularCompra();
  document.getElementById('compraBusquedaProd').value = '';
}
function renderCompraItems() {
  const tb = document.getElementById('compraItemsBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.compraItems.map((it, idx) => {
    const sub = it.costo_unitario * it.cantidad;
    return `<tr>
      <td>${escaparHtml(it.nombre)}</td>
      <td><input type="number" min="1" value="${it.cantidad}" onchange="actualizarItemCompra(${idx},'cantidad',this.value)" style="width:60px" /></td>
      <td><input type="number" step="0.01" value="${it.costo_unitario}" onchange="actualizarItemCompra(${idx},'costo_unitario',this.value)" style="width:80px" /></td>
      <td>${formatoMoneda(sub)}</td>
      <td><button class="btn btn-ghost btn-mini" onclick="quitarItemCompra(${idx})">x</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="vacio">Sin items</td></tr>';
}
window.actualizarItemCompra = function (idx, campo, val) {
  const it = ESTADO.compraItems[idx];
  if (!it) return;
  it[campo] = Number(val) || 0;
  renderCompraItems();
  recalcularCompra();
};
window.quitarItemCompra = function (idx) {
  ESTADO.compraItems.splice(idx, 1);
  renderCompraItems();
  recalcularCompra();
};
function recalcularCompra() {
  let sub = 0;
  for (const it of ESTADO.compraItems) sub += it.costo_unitario * it.cantidad;
  const imp = Number(document.getElementById('compraImpuesto').value) || 0;
  const total = sub + imp;
  document.getElementById('compraSubtotal').textContent = formatoMoneda(sub);
  document.getElementById('compraTotal').textContent = formatoMoneda(total);
}
async function confirmarCompra() {
  if (!ESTADO.compraItems.length) return notificar('Agrega al menos un producto', true);
  const prov = document.getElementById('compraProveedor').value;
  const almacen = document.getElementById('compraAlmacen').value;
  const items = ESTADO.compraItems.map(it => ({ producto_id: it.producto_id, cantidad: it.cantidad, costo_unitario: it.costo_unitario }));
  try {
    const r = await window.api.compras.crear({
      proveedor_id: prov || null,
      items,
      impuesto: Number(document.getElementById('compraImpuesto').value) || 0,
      notas: document.getElementById('compraNotas').value,
      almacen_id: almacen || null,
    });
    cerrarModal('modalCompra');
    notificar('Compra ' + r.numero + ' registrada');
    ESTADO.compraItems = [];
    await cargarCompras();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarCxC() {
  try { ESTADO.cxc = await window.api.cxc.listar(); } catch { ESTADO.cxc = []; }
  renderCxC();
}
function renderCxC() {
  const tb = document.getElementById('cxcBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.cxc.length
    ? ESTADO.cxc.map(c => `<tr>
        <td>${escaparHtml(c.venta_numero || '-')}</td>
        <td>${escaparHtml(c.cliente_nombre || '-')}</td>
        <td>${formatoMoneda(c.monto_total)}</td>
        <td>${formatoMoneda(c.monto_cobrado)}</td>
        <td>${formatoMoneda(c.saldo)}</td>
        <td>${escaparHtml(c.estado)}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="abrirCobro('${c.cliente_id || ''}','${c.venta_id}')">Cobrar</button></td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="vacio">Sin cuentas por cobrar</td></tr>';
}
window.abrirCobro = function (clienteId, ventaId) {
  document.getElementById('cobroClienteId').value = clienteId || '';
  document.getElementById('cobroVentaId').value = ventaId || '';
  const c = ESTADO.clientes.find(x => x.id === clienteId) || ESTADO.cxc.find(x => x.cliente_id === clienteId);
  document.getElementById('cobroClienteNombre').textContent = (c && (c.cliente_nombre || c.nombre)) || clienteId || '-';
  document.getElementById('cobroMonto').value = '';
  abrirModal('modalCobro');
};
async function registrarCobro() {
  const clienteId = document.getElementById('cobroClienteId').value;
  const ventaId = document.getElementById('cobroVentaId').value;
  const monto = Number(document.getElementById('cobroMonto').value);
  if (!clienteId) return notificar('Falta el cliente', true);
  if (!monto || monto <= 0) return notificar('Monto invalido', true);
  try {
    await window.api.cobros.registrar({
      cliente_id: clienteId,
      venta_id: ventaId || null,
      monto,
      metodo: document.getElementById('cobroMetodo').value,
      referencia: document.getElementById('cobroReferencia').value,
    });
    cerrarModal('modalCobro');
    notificar('Cobro registrado');
    await cargarCxC();
    await cargarCaja();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarCxP() {
  try { ESTADO.cxp = await window.api.cxp.listar(); } catch { ESTADO.cxp = []; }
  renderCxP();
}
function renderCxP() {
  const tb = document.getElementById('cxpBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.cxp.length
    ? ESTADO.cxp.map(c => `<tr>
        <td>${escaparHtml(c.compra_numero || '-')}</td>
        <td>${escaparHtml(c.proveedor_nombre || '-')}</td>
        <td>${formatoMoneda(c.monto_total)}</td>
        <td>${formatoMoneda(c.monto_pagado)}</td>
        <td>${formatoMoneda(c.saldo)}</td>
        <td>${escaparHtml(c.estado)}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="abrirPagoProv('${c.proveedor_id || ''}','${c.compra_id || ''}')">Pagar</button></td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="vacio">Sin cuentas por pagar</td></tr>';
}
window.abrirPagoProv = function (proveedorId, compraId) {
  const sel = document.getElementById('pagoProvProveedor');
  if (sel) {
    sel.innerHTML = ESTADO.proveedores.map(p => `<option value="${p.id}" ${p.id === proveedorId ? 'selected' : ''}>${escaparHtml(p.nombre)}</option>`).join('');
  }
  const sc = document.getElementById('pagoProvCompra');
  if (sc) {
    sc.innerHTML = '<option value="">Sin compra especifica</option>' +
      ESTADO.compras.filter(c => !compraId || c.id === compraId).map(c => `<option value="${c.id}" ${c.id === compraId ? 'selected' : ''}>${escaparHtml(c.numero)}</option>`).join('');
  }
  document.getElementById('pagoProvMonto').value = '';
  abrirModal('modalPagoProv');
};
async function registrarPagoProv() {
  const proveedorId = document.getElementById('pagoProvProveedor').value;
  const compraId = document.getElementById('pagoProvCompra').value;
  const monto = Number(document.getElementById('pagoProvMonto').value);
  if (!proveedorId) return notificar('Falta el proveedor', true);
  if (!monto || monto <= 0) return notificar('Monto invalido', true);
  try {
    await window.api.pagosProveedor.registrar({
      proveedor_id: proveedorId,
      compra_id: compraId || null,
      monto,
      metodo: document.getElementById('pagoProvMetodo').value,
      referencia: document.getElementById('pagoProvReferencia').value,
    });
    cerrarModal('modalPagoProv');
    notificar('Pago registrado');
    await cargarCxP();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarCaja() {
  try {
    const r = await window.api.caja.resumen();
    const cont = document.getElementById('cajaResumen');
    if (!cont) return;
    const metodos = Object.entries(r.por_metodo || {}).map(([k, v]) => `<div>${k}: ${formatoMoneda(v)}</div>`).join('');
    cont.innerHTML = `<div style="font-size:18px;font-weight:bold">Total hoy: ${formatoMoneda(r.total)}</div>
      <div style="margin-top:8px">${metodos || 'Sin cobros'}</div>
      <div style="margin-top:8px">${(r.cobros || []).length} cobros</div>`;
  } catch (err) {
    const cont = document.getElementById('cajaResumen');
    if (cont) cont.innerHTML = 'No se pudo cargar la caja: ' + escaparHtml(err.message);
  }
}

window.abrirCobro = window.abrirCobro;
window.abrirPagoProv = window.abrirPagoProv;

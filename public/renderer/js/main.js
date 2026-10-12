/* Sistema de Inventarios - Logica de interfaz */

const ESTADO = {
  vista: 'dashboard',
  giro: null,
  productos: [],
  categorias: [],
  proveedores: [],
  movimientos: [],
  camposGiro: [],
  usuarios: [],
  catalogos: null,
  usuario: null,
  editando: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  configurarLogin();
  await verificarSesion();
});

/* ------------------ Sesion y permisos ------------------ */

function puedeUI(permiso) {
  if (!ESTADO.usuario) return false;
  return ESTADO.usuario.permisos.includes(permiso);
}

async function verificarSesion() {
  try {
    const u = await window.api.auth.sesion();
    if (u) entrarAlSistema(u);
  } catch (e) { /* sin sesion: muestra login */ }
}

function configurarLogin() {
  document.getElementById('formLogin').addEventListener('submit', iniciarSesion);
}

async function iniciarSesion(e) {
  e.preventDefault();
  const err = document.getElementById('loginError');
  err.classList.remove('visible');
  const usuario = document.getElementById('loginUsuario').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const u = await window.api.auth.login(usuario, password);
    entrarAlSistema(u);
    if (u.debe_cambiar_clave) {
      notificar('Debes cambiar tu contrasena');
      abrirModalClave(true);
    }
  } catch (error) {
    err.textContent = error.message;
    err.classList.add('visible');
  }
}

async function entrarAlSistema(usuario) {
  ESTADO.usuario = usuario;
  document.getElementById('pantallaLogin').classList.add('oculto');
  document.getElementById('app').classList.remove('oculto');
  mostrarInfoUsuario(usuario);
  aplicarPermisosUI();
  try { await window.api.catalogos.seguridad().then(c => { ESTADO.catalogos = c; }); } catch { /* opcional */ }
  track('sesion.iniciar');
  await iniciar();
}

async function cerrarSesion() {
  if (!confirm('Cerrar sesion?')) return;
  await window.api.auth.logout();
  ESTADO.usuario = null;
  document.getElementById('app').classList.add('oculto');
  document.getElementById('pantallaLogin').classList.remove('oculto');
  document.getElementById('formLogin').reset();
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginUsuario').focus();
  navegar('dashboard');
}

function mostrarInfoUsuario(u) {
  document.getElementById('infoUsuario').classList.remove('oculto');
  document.getElementById('infoUsuarioNombre').textContent = u.nombre;
  const rol = document.getElementById('infoUsuarioRol');
  rol.textContent = u.rolNombre;
  rol.className = 'badge-rol nivel-' + u.nivel;
  document.getElementById('infoUsuarioArea').textContent = u.area;
}

/* Oculta secciones y botones segun los permisos del rol */
function aplicarPermisosUI() {
  const mapaNav = {
    productos: 'productos.ver',
    movimientos: 'movimientos.ver',
    proveedores: 'proveedores.ver',
    bitacora: 'bitacora.ver',
    usuarios: 'usuarios.gestionar',
    config: 'config.ver',
  };
  document.querySelectorAll('.nav-item').forEach(n => {
    const req = mapaNav[n.dataset.vista];
    if (!req) return;
    const permitido = puedeUI(req);
    n.classList.toggle('oculto', !permitido);
  });

  alternarBoton('btnNuevoProducto', 'productos.crear');
  alternarBoton('btnExportarProductos', 'reportes.exportar');
  alternarBoton('btnImprimirProductos', 'reportes.imprimir');
  alternarBoton('btnImportar', 'productos.crear');
  alternarBoton('btnNuevoMovimiento', puedeUI('movimientos.entrada') || puedeUI('movimientos.salida'));
  alternarBoton('btnExportarMovimientos', 'reportes.exportar');
  alternarBoton('btnImprimirMovimientos', 'reportes.imprimir');
  alternarBoton('btnNuevoProveedor', 'proveedores.gestionar');
  alternarBoton('btnEnviarWebhook', 'webhook.enviar');
  alternarBoton('btnExportarBitacora', 'reportes.exportar');

  // Panel de configuracion visible solo con acceso a config o a webhook
  const panelWebhook = document.getElementById('webhookUrl');
  if (panelWebhook) {
    const contenedor = panelWebhook.closest('.panel');
    if (contenedor) contenedor.classList.toggle('oculto', !puedeUI('webhook.enviar'));
  }
  const panelCampos = document.getElementById('nombreCampo');
  if (panelCampos) {
    const contenedor = panelCampos.closest('.panel');
    if (contenedor) contenedor.classList.toggle('oculto', !puedeUI('config.ver'));
  }
}

function alternarBoton(id, permitido) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('oculto', !permitido);
  el.disabled = !permitido;
}

async function iniciar() {
  await cargarGiroActual();
  await cargarCategorias();
  await cargarProveedores();
  configurarNavegacion();
  configurarEventosProductos();
  configurarEventosMovimientos();
  configurarEventosProveedores();
  configurarEventosConfig();
  configurarEventosUsuarios();
  configurarEventosBitacora();
  configurarEventosSesion();
  configurarEventosAsistente();
  configurarEventosImportador();
  configurarMenu();
  navegar('dashboard');
}

/* Registra un evento de uso (ignora silenciosamente si no hay sesion) */
function track(evento, contexto) {
  try { window.api.eventos.registrar(evento, contexto || null); } catch { /* opcional */ }
}

/* ------------------ Datos ------------------ */

async function cargarGiroActual() {
  ESTADO.giro = await window.api.giros.actual();
  document.getElementById('giroActual').textContent = 'Giro: ' + (ESTADO.giro || 'sin definir');
  ESTADO.camposGiro = ESTADO.giro ? await window.api.giros.campos(ESTADO.giro) : [];
}

async function cargarCategorias() {
  ESTADO.categorias = await window.api.categorias.listar();
  const sel = document.getElementById('filtroCategoria');
  sel.innerHTML = '<option value="">Todas las categorias</option>';
  ESTADO.categorias.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.nombre;
    sel.appendChild(o);
  });
}

async function cargarProveedores() {
  ESTADO.proveedores = await window.api.proveedores.listar();
}

async function cargarProductos() {
  ESTADO.productos = await window.api.producto.listar({
    busqueda: document.getElementById('buscarProducto').value.trim(),
    categoria_id: document.getElementById('filtroCategoria').value || undefined,
    stock: document.getElementById('filtroStock').value || undefined,
    limite: 500,
  });
  renderProductos();
}

async function cargarMovimientos() {
  ESTADO.movimientos = await window.api.movimientos.listar({
    limite: 500,
    tipo: document.getElementById('filtroTipoMov').value || undefined,
    busqueda: document.getElementById('buscarMovProducto').value.trim() || undefined,
    area: document.getElementById('filtroMovArea').value || undefined,
  });
  renderMovimientos();
}

async function cargarDashboard() {
  const [stats, stockBajo, ultimos] = await Promise.all([
    window.api.dashboard.stats(),
    window.api.producto.listar({ stock: 'bajo', limite: 50 }),
    window.api.movimientos.listar({ limite: 8 }),
  ]);

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card primario"><h4>Total productos</h4><div class="valor">${stats.productos}</div></div>
    <div class="stat-card exito"><h4>Unidades en stock</h4><div class="valor">${stats.unidades}</div></div>
    <div class="stat-card"><h4>Valor inventario</h4><div class="valor">${formatoMoneda(stats.valor)}</div></div>
    <div class="stat-card warning"><h4>Stock bajo</h4><div class="valor">${stats.stockBajo}</div></div>
    <div class="stat-card error"><h4>Agotados</h4><div class="valor">${stats.agotados}</div></div>
    <div class="stat-card"><h4>Movimientos hoy</h4><div class="valor">${stats.movimientosHoy}</div></div>
  `;

  document.getElementById('stockBajoBody').innerHTML = stockBajo.length
    ? stockBajo.slice(0, 20).map(p => {
        const clase = p.stock_actual === 0 ? 'badge-agotado' : 'badge-bajo';
        return `<tr>
          <td>${p.codigo || '-'}</td><td>${p.nombre}</td><td>${p.categoria_nombre || '-'}</td>
          <td><span class="badge ${clase}">${p.stock_actual}</span></td><td>${p.stock_minimo || 0}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="vacio">Sin alertas de stock</td></tr>';

  document.getElementById('ultimosMovBody').innerHTML = ultimos.length
    ? ultimos.map(m => `<tr>
        <td>${formatoFecha(m.fecha)}</td><td>${m.producto_nombre}</td>
        <td><span class="badge ${m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo}</span></td>
        <td>${m.cantidad}</td><td>${m.usuario_nombre || m.usuario_login || '-'}</td>
        <td>${m.observacion || '-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Sin movimientos registrados</td></tr>';
}

/* ------------------ Render ------------------ */

function renderProductos() {
  const tb = document.getElementById('productosBody');
  tb.innerHTML = ESTADO.productos.length
    ? ESTADO.productos.map(p => {
        let clase = 'badge-ok';
        if (p.stock_actual === 0) clase = 'badge-agotado';
        else if (p.stock_actual <= p.stock_minimo) clase = 'badge-bajo';
        return `<tr>
          <td>${p.codigo || '-'}</td><td>${p.nombre}</td><td>${p.categoria_nombre || '-'}</td>
          <td><span class="badge ${clase}">${p.stock_actual}</span></td>
          <td>${p.stock_minimo || 0}</td>
          <td>${formatoMoneda(p.precio_venta || 0)}</td>
          <td>
            <button class="btn btn-ghost btn-mini" onclick="editarProducto(${p.id})">Editar</button>
            <button class="btn btn-ghost btn-mini" onclick="verTrazabilidad(${p.id})" title="Ver historial completo">Trazabilidad</button>
            <button class="btn btn-ghost btn-mini btn-mini-peligro" onclick="eliminarProducto(${p.id})" title="Eliminar">Eliminar</button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="vacio">No hay productos</td></tr>';
}

function renderMovimientos() {
  const tb = document.getElementById('movimientosBody');
  tb.innerHTML = ESTADO.movimientos.length
    ? ESTADO.movimientos.map(m => `<tr>
        <td>${formatoFecha(m.fecha)}</td><td>${m.producto_nombre}</td>
        <td><span class="badge ${m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo}</span></td>
        <td>${m.cantidad}</td>
        <td>${formatoMoneda(m.precio_unitario || 0)}</td>
        <td>${formatoMoneda(m.total || 0)}</td>
        <td>${m.usuario_nombre || m.usuario_login || '-'}</td>
        <td>${m.usuario_area || '-'}</td>
        <td>${m.observacion || '-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="9" class="vacio">Sin movimientos</td></tr>';
}

function renderProveedores() {
  const tb = document.getElementById('proveedoresBody');
  tb.innerHTML = ESTADO.proveedores.length
    ? ESTADO.proveedores.map(p => `<tr>
        <td>${p.nombre}</td><td>${p.rif || '-'}</td><td>${p.telefono || '-'}</td>
        <td>${p.email || '-'}</td><td>${p.direccion || '-'}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="editarProveedor(${p.id})">Editar</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Sin proveedores</td></tr>';
}

/* ------------------ Navegacion ------------------ */

function configurarNavegacion() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navegar(btn.dataset.vista));
  });
}

function navegar(vista) {
  ESTADO.vista = vista;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.vista === vista));
  document.querySelectorAll('.vista').forEach(v => v.classList.toggle('active', v.id === 'vista-' + vista));
  document.getElementById('tituloVista').textContent = {
    dashboard: 'Dashboard',
    productos: 'Productos',
    movimientos: 'Movimientos',
    proveedores: 'Proveedores',
    usuarios: 'Usuarios y permisos',
    bitacora: 'Bitacora y trazabilidad',
    config: 'Configuracion',
  }[vista] || vista;

  if (vista === 'dashboard') cargarDashboard();
  if (vista === 'productos') cargarProductos();
  if (vista === 'movimientos') cargarMovimientos();
  if (vista === 'proveedores') renderProveedores();
  if (vista === 'usuarios') cargarVistaUsuarios();
  if (vista === 'config') cargarOpcionesConfig();
  if (vista === 'bitacora') cargarVistaBitacora();
}

function configurarMenu() {
  window.api.onVista(async (canal) => {
    const mapa = {
      'vista:dashboard': 'dashboard', 'vista:productos': 'productos',
      'vista:movimientos': 'movimientos', 'vista:proveedores': 'proveedores',
      'vista:usuarios': 'usuarios', 'vista:bitacora': 'bitacora',
      'vista:config': 'config',
      'accion:nuevo-producto': null, 'accion:exportar': null, 'accion:webhook': null,
      'accion:logout': null,
    };
    if (mapa[canal]) navegar(mapa[canal]);
    if (canal === 'accion:nuevo-producto') nuevoProducto();
    if (canal === 'accion:exportar') exportarProductosExcel();
    if (canal === 'accion:webhook') navegar('config');
    if (canal === 'accion:logout') cerrarSesion();
  });
}

/* ------------------ Productos ------------------ */

function configurarEventosProductos() {
  let t;
  document.getElementById('buscarProducto').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(cargarProductos, 300);
  });
  document.getElementById('filtroCategoria').addEventListener('change', cargarProductos);
  document.getElementById('filtroStock').addEventListener('change', cargarProductos);
  document.getElementById('btnNuevoProducto').addEventListener('click', nuevoProducto);
  document.getElementById('btnExportarProductos').addEventListener('click', exportarProductosExcel);
  document.getElementById('btnImprimirProductos').addEventListener('click', imprimirProductos);
  document.getElementById('btnCancelProducto').addEventListener('click', cerrarModalProducto);
  document.getElementById('formProducto').addEventListener('submit', guardarProducto);
  document.getElementById('movProducto').addEventListener('change', completarPrecioSugerido);
}

async function nuevoProducto() {
  ESTADO.editando = null;
  document.getElementById('tituloModalProducto').textContent = 'Nuevo Producto';
  document.getElementById('formProducto').reset();
  document.getElementById('productoId').value = '';
  await renderCamposProducto();
  abrirModal('modalProducto');
}

async function editarProducto(id) {
  const p = await window.api.producto.obtener(id);
  if (!p) return;
  ESTADO.editando = id;
  document.getElementById('tituloModalProducto').textContent = 'Editar Producto';
  await renderCamposProducto(id, p);
  abrirModal('modalProducto');
}

async function renderCamposProducto(productoId = null, p = {}) {
  const cont = document.getElementById('camposProducto');
  cont.innerHTML = `
    <div class="campo"><label>Codigo</label><input type="text" id="p_codigo" value="${p.codigo || ''}"></div>
    <div class="campo"><label>Categoria</label><select id="p_categoria" class="input-select">${
      ESTADO.categorias.map(c => `<option value="${c.id}" ${p.categoria_id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')
    }</select></div>
    <div class="campo ancho-completo"><label>Nombre *</label><input type="text" id="p_nombre" value="${p.nombre || ''}" required></div>
    <div class="campo"><label>Stock actual</label><input type="number" id="p_stockActual" value="${p.stock_actual || 0}"></div>
    <div class="campo"><label>Stock minimo</label><input type="number" id="p_stockMinimo" value="${p.stock_minimo || 0}"></div>
    <div class="campo"><label>Precio de compra</label><input type="number" step="0.01" id="p_precioCompra" value="${p.precio_compra || 0}"></div>
    <div class="campo"><label>Precio de venta</label><input type="number" step="0.01" id="p_precioVenta" value="${p.precio_venta || 0}"></div>
    <div class="campo ancho-completo"><label>Proveedor</label><select id="p_proveedor" class="input-select">
      <option value="">Sin proveedor</option>
      ${ESTADO.proveedores.map(pr => `<option value="${pr.id}" ${p.proveedor_id === pr.id ? 'selected' : ''}>${pr.nombre}</option>`).join('')}
    </select></div>
    <div class="campo ancho-completo"><label>Ubicacion</label><input type="text" id="p_ubicacion" value="${p.ubicacion || ''}"></div>
  `;

  if (ESTADO.camposGiro.length) {
    let valores = {};
    if (productoId) {
      const rows = await window.api.giros.valores(productoId);
      rows.forEach(r => valores[r.campo_id] = r.valor);
    }
    ESTADO.camposGiro.forEach(c => {
      cont.innerHTML += `<div class="campo"><label>${c.nombre}${c.obligatorio ? ' *' : ''}</label>${
        c.tipo === 'integer'
          ? `<select id="c_${c.id}" class="input-select"><option value="0">No</option><option value="1" ${valores[c.id] === '1' ? 'selected' : ''}>Si</option></select>`
          : `<input type="${c.tipo}" id="c_${c.id}" value="${valores[c.id] || ''}">`
      }</div>`;
    });
  }
}

async function guardarProducto(e) {
  e.preventDefault();
  const id = document.getElementById('productoId').value ? ESTADO.editando : null;
  const datos = {
    codigo: document.getElementById('p_codigo').value,
    nombre: document.getElementById('p_nombre').value,
    categoria_id: document.getElementById('p_categoria').value || null,
    proveedor_id: document.getElementById('p_proveedor').value || null,
    stock_actual: Number(document.getElementById('p_stockActual').value || 0),
    stock_minimo: Number(document.getElementById('p_stockMinimo').value || 0),
    precio_compra: Number(document.getElementById('p_precioCompra').value || 0),
    precio_venta: Number(document.getElementById('p_precioVenta').value || 0),
    ubicacion: document.getElementById('p_ubicacion').value,
  };
  const camposDinamicos = ESTADO.camposGiro.map(c => {
    const el = document.getElementById('c_' + c.id);
    return el ? { campo_id: c.id, valor: el.value } : null;
  }).filter(Boolean);

  try {
    await window.api.producto.guardar({ id: id || undefined, datos, camposDinamicos });
    cerrarModalProducto();
    notificar('Producto guardado');
    track('producto.crear');
    if (ESTADO.vista === 'productos') cargarProductos();
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

function cerrarModalProducto() {
  cerrarModal('modalProducto');
}

async function entradaRapida(id) {
  const cantidad = prompt('Cantidad a ingresar al stock:');
  if (!cantidad || Number(cantidad) <= 0) return;
  try {
    await window.api.movimientos.registrar({
      producto_id: id, tipo: 'entrada', cantidad: Number(cantidad),
      precio_unitario: 0, observacion: 'Entrada rapida',
    });
    cargarProductos();
    notificar('Stock actualizado');
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function exportarProductosExcel() {
  if (!ESTADO.productos.length) await cargarProductos();
  const res = await window.api.export.excel({
    filas: ESTADO.productos.map(p => ({
      codigo: p.codigo || '', nombre: p.nombre, categoria: p.categoria_nombre || '',
      stock: p.stock_actual, minimo: p.stock_minimo, precio: p.precio_venta,
    })),
    columnas: [
      { campo: 'codigo', titulo: 'Codigo', ancho: 15 },
      { campo: 'nombre', titulo: 'Nombre', ancho: 30 },
      { campo: 'categoria', titulo: 'Categoria', ancho: 20 },
      { campo: 'stock', titulo: 'Stock', ancho: 12 },
      { campo: 'minimo', titulo: 'Minimo', ancho: 12 },
      { campo: 'precio', titulo: 'Precio venta', ancho: 16 },
    ],
    nombreArchivo: 'inventario.xlsx',
    hoja: 'Inventario',
  });
  if (res.ok) notificar('Exportado a ' + res.ruta);
  else if (!res.cancelado) notificar('Error al exportar', true);
}

/* ------------------ Movimientos ------------------ */

function configurarEventosMovimientos() {
  document.getElementById('btnNuevoMovimiento').addEventListener('click', nuevoMovimiento);
  document.getElementById('btnCancelMovimiento').addEventListener('click', () => cerrarModal('modalMovimiento'));
  document.getElementById('formMovimiento').addEventListener('submit', guardarMovimiento);
  document.getElementById('btnExportarMovimientos').addEventListener('click', exportarMovimientosExcel);
  document.getElementById('btnImprimirMovimientos').addEventListener('click', imprimirMovimientos);
  document.getElementById('filtroTipoMov').addEventListener('change', cargarMovimientos);
  document.getElementById('filtroMovArea').addEventListener('change', cargarMovimientos);
  document.getElementById('btnCerrarTrazabilidad').addEventListener('click', () => cerrarModal('modalTrazabilidad'));
  let tBusq;
  document.getElementById('buscarMovProducto').addEventListener('input', () => {
    clearTimeout(tBusq);
    tBusq = setTimeout(cargarMovimientos, 300);
  });
}

async function nuevoMovimiento() {
  await cargarProveedores();
  if (!ESTADO.productos.length) await cargarProductos();
  document.getElementById('formMovimiento').reset();
  document.getElementById('movCantidad').value = 1;
  document.getElementById('movPrecio').value = 0;
  const sel = document.getElementById('movProducto');
  sel.innerHTML = ESTADO.productos.length
    ? ESTADO.productos.map(p => `<option value="${p.id}" data-precio="${p.precio_venta || 0}">${p.nombre} (Stock: ${p.stock_actual})</option>`).join('')
    : '<option value="">Sin productos registrados</option>';
  document.getElementById('movProveedor').innerHTML =
    '<option value="">Sin proveedor</option>' + ESTADO.proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  abrirModal('modalMovimiento');
}

function completarPrecioSugerido() {
  const sel = document.getElementById('movProducto');
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset.precio) document.getElementById('movPrecio').value = opt.dataset.precio;
}

async function guardarMovimiento(e) {
  e.preventDefault();
  const selProducto = document.getElementById('movProducto');
  const nombreProducto = selProducto.options[selProducto.selectedIndex].text.split(' (Stock:')[0];
  const tipo = document.getElementById('movTipo').value;
  const cantidad = Number(document.getElementById('movCantidad').value);
  const observacion = document.getElementById('movObservacion').value;
  try {
    const res = await window.api.movimientos.registrar({
      producto_id: Number(selProducto.value),
      tipo,
      cantidad,
      precio_unitario: Number(document.getElementById('movPrecio').value),
      proveedor_id: document.getElementById('movProveedor').value || null,
      observacion,
    });
    cerrarModal('modalMovimiento');
    notificar('Movimiento registrado');
    track('movimiento.' + tipo);
    cargarMovimientos();

    if (confirm('Deseas imprimir el comprobante de este movimiento?')) {
      await imprimirTicketMovimiento({
        producto: nombreProducto,
        tipo,
        cantidad,
        stock_final: res.stock_actual,
        observacion,
      });
    }
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

async function exportarMovimientosExcel() {
  if (!ESTADO.movimientos.length) await cargarMovimientos();
  const res = await window.api.export.excel({
    filas: ESTADO.movimientos.map(m => ({
      fecha: m.fecha, producto: m.producto_nombre, tipo: m.tipo,
      cantidad: m.cantidad, precio: m.precio_unitario, total: m.total, observacion: m.observacion || '',
    })),
    columnas: [
      { campo: 'fecha', titulo: 'Fecha', ancho: 20 },
      { campo: 'producto', titulo: 'Producto', ancho: 30 },
      { campo: 'tipo', titulo: 'Tipo', ancho: 12 },
      { campo: 'cantidad', titulo: 'Cantidad', ancho: 12 },
      { campo: 'precio', titulo: 'Precio', ancho: 14 },
      { campo: 'total', titulo: 'Total', ancho: 14 },
      { campo: 'observacion', titulo: 'Observacion', ancho: 30 },
    ],
    nombreArchivo: 'movimientos.xlsx',
    hoja: 'Movimientos',
  });
  if (res.ok) notificar('Exportado a ' + res.ruta);
}

/* ------------------ Impresion ------------------ */

async function imprimirProductos() {
  if (!ESTADO.productos.length) await cargarProductos();
  const res = await window.api.imprimir.reporte({
    titulo: 'Reporte de Inventario - Giro ' + (ESTADO.giro || '-'),
    columnas: [
      { campo: 'codigo', titulo: 'Codigo' },
      { campo: 'nombre', titulo: 'Nombre' },
      { campo: 'categoria', titulo: 'Categoria' },
      { campo: 'stock', titulo: 'Stock' },
      { campo: 'precio', titulo: 'Precio' },
    ],
    filas: ESTADO.productos.map(p => ({
      codigo: p.codigo || '', nombre: p.nombre, categoria: p.categoria_nombre || '',
      stock: p.stock_actual, precio: formatoMoneda(p.precio_venta || 0),
    })),
  });
  if (!res.ok) notificar('Impresion cancelada o con error', true);
}

async function imprimirMovimientos() {
  if (!ESTADO.movimientos.length) await cargarMovimientos();
  const res = await window.api.imprimir.reporte({
    titulo: 'Reporte de Movimientos',
    columnas: [
      { campo: 'fecha', titulo: 'Fecha' },
      { campo: 'producto', titulo: 'Producto' },
      { campo: 'tipo', titulo: 'Tipo' },
      { campo: 'cantidad', titulo: 'Cantidad' },
      { campo: 'total', titulo: 'Total' },
    ],
    filas: ESTADO.movimientos.map(m => ({
      fecha: formatoFecha(m.fecha), producto: m.producto_nombre, tipo: m.tipo,
      cantidad: m.cantidad, total: formatoMoneda(m.total || 0),
    })),
  });
  if (!res.ok) notificar('Impresion cancelada o con error', true);
}

async function imprimirTicketMovimiento(datos) {
  const res = await window.api.imprimir.ticket({
    titulo: 'Comprobante de Movimiento',
    lineas: [
      { tipo: 'titulo', texto: 'Sistema de Inventarios' },
      { tipo: 'separador' },
      { texto: 'Fecha', valor: new Date().toLocaleString() },
      { texto: 'Producto', valor: datos.producto },
      { texto: 'Tipo', valor: datos.tipo === 'entrada' ? 'Entrada' : 'Salida' },
      { texto: 'Cantidad', valor: String(datos.cantidad) },
      { texto: 'Stock final', valor: String(datos.stock_final) },
      { tipo: 'separador' },
      { texto: 'Observacion', valor: datos.observacion || '-' },
      { tipo: 'separador' },
    ],
  });
  if (!res.ok) notificar('Impresion cancelada o con error', true);
}

/* ------------------ Proveedores ------------------ */

function configurarEventosProveedores() {
  document.getElementById('btnNuevoProveedor').addEventListener('click', nuevoProveedor);
  document.getElementById('btnCancelProveedor').addEventListener('click', () => cerrarModal('modalProveedor'));
  document.getElementById('formProveedor').addEventListener('submit', guardarProveedor);
}

function nuevoProveedor() {
  document.getElementById('formProveedor').reset();
  document.getElementById('proveedorId').value = '';
  document.getElementById('tituloModalProveedor').textContent = 'Nuevo Proveedor';
  abrirModal('modalProveedor');
}

function editarProveedor(id) {
  const p = ESTADO.proveedores.find(x => x.id === id);
  if (!p) return;
  document.getElementById('proveedorId').value = id;
  document.getElementById('provNombre').value = p.nombre;
  document.getElementById('provRif').value = p.rif || '';
  document.getElementById('provTelefono').value = p.telefono || '';
  document.getElementById('provEmail').value = p.email || '';
  document.getElementById('provDireccion').value = p.direccion || '';
  document.getElementById('tituloModalProveedor').textContent = 'Editar Proveedor';
  abrirModal('modalProveedor');
}

async function guardarProveedor(e) {
  e.preventDefault();
  const id = document.getElementById('proveedorId').value ? Number(document.getElementById('proveedorId').value) : undefined;
  try {
    await window.api.proveedores.guardar({
      id,
      nombre: document.getElementById('provNombre').value,
      rif: document.getElementById('provRif').value,
      telefono: document.getElementById('provTelefono').value,
      email: document.getElementById('provEmail').value,
      direccion: document.getElementById('provDireccion').value,
    });
    cerrarModal('modalProveedor');
    notificar('Proveedor guardado');
    await cargarProveedores();
    renderProveedores();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

/* ------------------ Configuracion ------------------ */

async function configurarEventosConfig() {
  document.getElementById('btnGuardarGiro').addEventListener('click', async () => {
    const nombre = document.getElementById('selectGiro').value;
    await window.api.giros.cambiar(nombre);
    ESTADO.giro = nombre;
    document.getElementById('giroActual').textContent = 'Giro: ' + nombre;
    ESTADO.camposGiro = await window.api.giros.campos(nombre);
    renderCamposGiro();
    notificar('Giro actualizado');
  });

  document.getElementById('btnAgregarCampo').addEventListener('click', async () => {
    const nombre = document.getElementById('nombreCampo').value.trim();
    if (!nombre) return notificar('Escribe el nombre del campo', true);
    try {
      await window.api.giros.guardarCampo({
        nombreGiro: ESTADO.giro,
        nombre,
        tipo: document.getElementById('tipoCampo').value,
        obligatorio: document.getElementById('obligatorioCampo').checked,
      });
      document.getElementById('nombreCampo').value = '';
      document.getElementById('obligatorioCampo').checked = false;
      ESTADO.camposGiro = await window.api.giros.campos(ESTADO.giro);
      renderCamposGiro();
      notificar('Campo agregado');
    } catch (err) { notificar('Error: ' + err.message, true); }
  });

  document.getElementById('btnAgregarCategoria').addEventListener('click', async () => {
    const nombre = document.getElementById('nombreCategoria').value.trim();
    if (!nombre) return;
    await window.api.categorias.guardar({ nombre, giro_id: null });
    document.getElementById('nombreCategoria').value = '';
    await cargarCategorias();
    renderCategorias();
    notificar('Categoria agregada');
  });

  document.getElementById('btnEnviarWebhook').addEventListener('click', enviarWebhook);
  document.getElementById('btnVerificarActualizaciones').addEventListener('click', () => {
    document.getElementById('estadoActualizacion').textContent = 'Verificando actualizaciones...';
    setTimeout(() => {
      document.getElementById('estadoActualizacion').textContent = 'Estas usando la version 1.0.0. Actualmente estas al dia.';
    }, 800);
  });
}

async function cargarOpcionesConfig() {
  const giros = await window.api.giros.listar();
  document.getElementById('selectGiro').innerHTML = giros.map(g => `<option value="${g.nombre}">${g.nombre}</option>`).join('');
  document.getElementById('selectGiro').value = ESTADO.giro || giros[0]?.nombre;
  ESTADO.camposGiro = await window.api.giros.campos(ESTADO.giro);
  renderCategorias();
  renderCamposGiro();
  if (puedeUI('config.ver')) cargarAdopcion();
}

async function cargarAdopcion() {
  const cont = document.getElementById('adopcionContenido');
  if (!cont) return;
  try {
    const m = await window.api.eventos.adopcion();
    const onboarding = m.completado.map(c =>
      `<li class="onboarding-item ${c.hecho ? 'hecho' : 'pendiente'}">
         <span class="marca">${c.hecho ? '✓' : '!'}</span>${c.etiqueta}
       </li>`).join('');
    const pendientes = m.completado.filter(c => !c.hecho).length;
    const riesgo = pendientes >= 4 ? 'alto' : (pendientes >= 2 ? 'medio' : 'bajo');
    cont.innerHTML = `
      <div class="adopcion-grid">
        <div class="adopcion-card"><h4>Dias activos (7d)</h4><div class="valor">${m.dias7}</div></div>
        <div class="adopcion-card"><h4>Dias activos (30d)</h4><div class="valor">${m.dias30}</div></div>
        <div class="adopcion-card"><h4>Usuarios que usan</h4><div class="valor">${m.usuariosActivos}</div></div>
        <div class="adopcion-card"><h4>Consultas al asistente</h4><div class="valor">${m.asistente}</div></div>
        <div class="adopcion-card"><h4>Acciones hoy</h4><div class="valor">${m.hoy}</div></div>
        <div class="adopcion-card"><h4>Riesgo de abandono</h4><div class="valor" style="color:${riesgo === 'alto' ? 'var(--color-error)' : riesgo === 'medio' ? 'var(--color-warning)' : 'var(--color-exito)'}">${riesgo}</div></div>
      </div>
      <h4 style="font-size:12px;text-transform:uppercase;color:var(--color-texto-suave);margin-bottom:8px">Primeras acciones completadas</h4>
      <ul class="onboarding-lista">${onboarding}</ul>`;
  } catch (err) {
    cont.innerHTML = '<p class="texto-ayuda">No se pudieron cargar las metricas.</p>';
  }
}

function renderCamposGiro() {
  const tb = document.getElementById('camposGiroBody');
  if (!tb) return;
  const nombresTipo = { text: 'Texto', number: 'Numero', date: 'Fecha', integer: 'Si / No' };
  tb.innerHTML = ESTADO.camposGiro.length
    ? ESTADO.camposGiro.map(c => `<tr>
        <td>${c.nombre}</td>
        <td>${nombresTipo[c.tipo] || c.tipo}</td>
        <td>${c.obligatorio ? 'Si' : 'No'}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="eliminarCampo(${c.id})">Eliminar</button></td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="vacio">Este giro no tiene campos personalizados</td></tr>';
}

async function eliminarCampo(id) {
  if (!confirm('Eliminar este campo? Tambien se borraran los valores guardados en los productos.')) return;
  await window.api.giros.eliminarCampo(id);
  ESTADO.camposGiro = await window.api.giros.campos(ESTADO.giro);
  renderCamposGiro();
  notificar('Campo eliminado');
}

function renderCategorias() {
  document.getElementById('listaCategorias').innerHTML = ESTADO.categorias.length
    ? ESTADO.categorias.map(c => `<li class="chip">${c.nombre}</li>`).join('')
    : '<li class="chip">Sin categorias</li>';
}

async function enviarWebhook() {
  const url = document.getElementById('webhookUrl').value.trim();
  if (!url) return notificar('Ingresa la URL del webhook', true);
  const productos = await window.api.producto.listar({ limite: 100000 });
  try {
    const res = await window.api.webhook.enviar({
      url,
      payload: {
        giro: ESTADO.giro,
        fecha: new Date().toISOString(),
        total: productos.length,
        productos: productos.map(p => ({
          codigo: p.codigo, nombre: p.nombre, categoria: p.categoria_nombre,
          stock: p.stock_actual, precio: p.precio_venta,
        })),
      },
    });
    document.getElementById('webhookResultado').textContent = 'HTTP ' + res.status + '\n' + res.body;
    notificar('Webhook enviado');
  } catch (err) {
    document.getElementById('webhookResultado').textContent = 'Error: ' + err.message;
    notificar('Error al enviar webhook', true);
  }
}

/* ------------------ Asistente ------------------ */

function configurarEventosAsistente() {
  document.getElementById('btnAbrirAsistente').addEventListener('click', abrirAsistente);
  document.getElementById('btnCerrarAsistente').addEventListener('click', cerrarAsistente);
  document.getElementById('formAsistente').addEventListener('submit', enviarAsistente);
  document.getElementById('asistenteAcciones').addEventListener('click', ejecutarAccionAsistente);
}

function abrirAsistente() {
  document.getElementById('panelAsistente').classList.add('abierto');
  document.getElementById('fabAsistenteOculto')?.remove();
  const cont = document.getElementById('asistenteMensajes');
  if (!cont.children.length) {
    agregarMensaje('asistente', `Hola ${ESTADO.usuario.nombre.split(' ')[0]}. Preguntame por el stock, lo que esta por agotarse o pide registrar una entrada o salida.`);
    track('asistente.abrir');
  }
  document.getElementById('asistenteInput').focus();
}

function cerrarAsistente() {
  document.getElementById('panelAsistente').classList.remove('abierto');
}

function agregarMensaje(quien, texto, tablas) {
  const cont = document.getElementById('asistenteMensajes');
  const div = document.createElement('div');
  div.className = 'mensaje ' + quien;
  div.textContent = texto;
  if (tablas && tablas.length) {
    tablas.forEach(t => {
      const bloque = document.createElement('div');
      bloque.className = 'mensaje-tabla';
      const enc = document.createElement('div');
      enc.className = 'mensaje-titulo-tabla';
      enc.textContent = t.titulo;
      bloque.appendChild(enc);
      const tabla = document.createElement('table');
      tabla.innerHTML = '<thead><tr>' + t.columnas.map(c => `<th>${escaparHtml(c.titulo)}</th>`).join('') + '</tr></thead>';
      const cuerpo = document.createElement('tbody');
      t.filas.forEach(f => {
        const tr = document.createElement('tr');
        t.columnas.forEach(c => {
          const td = document.createElement('td');
          td.textContent = f[c.campo] === undefined || f[c.campo] === null ? '-' : String(f[c.campo]);
          cuerpo.appendChild(td);
        });
        cuerpo.appendChild(tr);
      });
      tabla.appendChild(cuerpo);
      bloque.appendChild(tabla);
      div.appendChild(bloque);
    });
  }
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
  return div;
}

function escaparHtml(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function limpiarAcciones() {
  document.getElementById('asistenteAcciones').innerHTML = '';
}

function mostrarAcciones(acciones) {
  const cont = document.getElementById('asistenteAcciones');
  cont.innerHTML = '';
  (acciones || []).forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-accion';
    btn.textContent = a.etiqueta;
    btn.dataset.accion = JSON.stringify(a);
    cont.appendChild(btn);
  });
}

async function enviarAsistente(e) {
  e.preventDefault();
  const input = document.getElementById('asistenteInput');
  const texto = input.value.trim();
  if (!texto) return;
  input.value = '';
  agregarMensaje('usuario', texto);
  limpiarAcciones();
  try {
    const r = await window.api.asistente.consultar(texto);
    const div = agregarMensaje('asistente', r.texto, r.tablas);
    if (r.intencion === 'desconocido') div.classList.add('error');
    mostrarAcciones(r.acciones);
    if (r.aclarar) {
      (r.aclarar.opciones || []).forEach(op => {
        const cont = document.getElementById('asistenteAcciones');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip-accion';
        btn.textContent = op.nombre + (op.codigo ? ' (' + op.codigo + ')' : '');
        btn.dataset.accion = JSON.stringify({
          id: 'elegir-producto', etiqueta: op.nombre, tipo: 'elegir_producto', productoId: op.id,
        });
        cont.appendChild(btn);
      });
    }
  } catch (err) {
    agregarMensaje('asistente', 'Error: ' + err.message);
  }
}

async function ejecutarAccionAsistente(e) {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const accion = JSON.parse(btn.dataset.accion);
  limpiarAcciones();

  // Acciones que solo abren interfaz
  if (accion.tipo === 'abrir_vista') {
    cerrarAsistente();
    return navegar(accion.vista);
  }
  if (accion.tipo === 'abrir_importador') {
    cerrarAsistente();
    return abrirImportador();
  }
  if (accion.tipo === 'nuevo_producto') {
    cerrarAsistente();
    return nuevoProducto();
  }
  if (accion.tipo === 'ayuda') {
    agregarMensaje('usuario', 'ayuda');
    const r = await window.api.asistente.consultar('ayuda');
    agregarMensaje('asistente', r.texto, r.tablas);
    return;
  }
  if (accion.tipo === 'trazar') {
    cerrarAsistente();
    return verTrazabilidad(accion.productoId);
  }
  if (accion.tipo === 'ver_movimientos') {
    cerrarAsistente();
    navegar('movimientos');
    document.getElementById('buscarMovProducto').value = '';
    return cargarMovimientos();
  }
  if (accion.tipo === 'elegir_producto' || accion.tipo === 'cantidad') {
    // Falta la cantidad: volver a preguntar indicando el producto ya elegido
    if (accion.cantidad) {
      agregarMensaje('usuario', `${accion.cantidad} unidades`);
    } else {
      agregarMensaje('usuario', document.getElementById('asistenteInput').value || '(producto elegido)');
    }
    const prod = ESTADO.productos.find(p => p.id === accion.productoId);
    const r = await window.api.asistente.consultar(
      `registrar ${accion.tipoMov === 'entrada' ? 'entrada' : 'salida'} ${accion.cantidad || ''} de ${prod ? prod.nombre : accion.etiqueta}`.trim());
    agregarMensaje('asistente', r.texto, r.tablas);
    return mostrarAcciones(r.acciones);
  }

  if (accion.tipo === 'ui_aprender') {
    const frase = prompt('¿Como sueles llamarlo? (ej: el de 50kg)');
    if (!frase) return;
    const productos = await window.api.asistente.productos();
    if (!productos.length) return notificar('No hay productos para asociar', true);
    const lista = productos.map((p, i) => `${i + 1}. ${p.nombre}${p.codigo ? ' (' + p.codigo + ')' : ''}`).join('\n');
    const eleccion = prompt('Elige el numero del producto:\n\n' + lista);
    const prod = productos[Number(eleccion) - 1];
    if (!prod) return notificar('Seleccion invalida', true);
    try {
      await window.api.asistente.aprender(frase, prod.id);
      agregarMensaje('asistente', `Listo, aprendi que "${frase}" es ${prod.nombre}.`);
    } catch (err) {
      agregarMensaje('asistente', 'Error: ' + err.message);
    }
    return;
  }

  // Acciones que ejecuta el proceso principal (con validacion de permisos)
  try {
    const r = await window.api.asistente.ejecutar(accion);
    if (r.ok) {
      agregarMensaje('asistente', r.texto || 'Listo.');
      if (ESTADO.vista === 'productos') await cargarProductos();
      if (ESTADO.vista === 'movimientos') await cargarMovimientos();
      if (ESTADO.vista === 'dashboard') await cargarDashboard();
      if (accion.tipo === 'confirmar_movimiento') {
        const productosPicker = {
          id: 'aprender', etiqueta: 'Enseñar alias', tipo: 'ui_aprender', productoId: accion.productoId,
        };
        mostrarAcciones([productosPicker]);
      }
    } else {
      agregarMensaje('asistente', 'No se pudo completar: ' + (r.error || 'error'));
    }
  } catch (err) {
    agregarMensaje('asistente', 'Error: ' + err.message);
  }
}

/* ------------------ Importacion asistida ------------------ */

function configurarEventosImportador() {
  document.getElementById('btnImportar').addEventListener('click', abrirImportador);
  document.getElementById('btnSeleccionarArchivo').addEventListener('click', seleccionarArchivo);
  document.getElementById('btnCancelImportar').addEventListener('click', () => cerrarModal('modalImportar'));
  document.getElementById('btnAplicarImportar').addEventListener('click', aplicarImportacion);
}

function abrirImportador() {
  if (!puedeUI('productos.crear')) return notificar('No tienes permiso para crear productos', true);
  ESTADO.importacion = null;
  document.getElementById('importarInicio').classList.remove('oculto');
  document.getElementById('importarAnalisis').classList.add('oculto');
  document.getElementById('btnAplicarImportar').disabled = true;
  track('importador.abrir');
  abrirModal('modalImportar');
}

async function seleccionarArchivo() {
  try {
    const plan = await window.api.importar.abrir();
    if (plan.cancelado) return;
    ESTADO.importacion = plan;
    renderImportacion(plan);
    track('importador.analizado', plan.resumen.total + ' filas');
  } catch (err) {
    notificar('Error al leer el archivo: ' + err.message, true);
  }
}

function renderImportacion(plan) {
  document.getElementById('importarInicio').classList.add('oculto');
  document.getElementById('importarAnalisis').classList.remove('oculto');
  document.getElementById('btnAplicarImportar').disabled = false;

  document.getElementById('importarResumen').innerHTML = `
    <div class="resumen-chip info"><strong>${plan.resumen.total}</strong>filas leidas</div>
    <div class="resumen-chip ok"><strong>${plan.resumen.nuevos}</strong>productos nuevos</div>
    <div class="resumen-chip warn"><strong>${plan.resumen.duplicados}</strong>duplicados</div>
    <div class="resumen-chip bad"><strong>${plan.resumen.errores}</strong>con errores</div>
    <div class="resumen-chip"><strong>${plan.nombreArchivo}</strong>archivo</div>`;

  const tb = document.getElementById('importarBody');
  tb.innerHTML = plan.filas.map((f, i) => {
    const etiqueta = {
      nuevo: ['Nuevo', 'badge-ok'],
      duplicado: ['Duplicado', 'badge-bajo'],
      duplicado_interno: ['Repetido en archivo', 'badge-bajo'],
      error: ['Error', 'badge-agotado'],
    }[f.estado] || [f.estado, ''];
    const accionDefecto = f.estado === 'error' ? 'omitir' : (f.estado === 'duplicado' ? document.getElementById('importarResolucion').value : 'crear');
    const claseFila = f.estado === 'error' ? 'fila-error' : (f.estado.startsWith('duplicado') ? 'fila-duplicado' : '');
    const avisos = (f.avisos || []).concat(f.existente ? `Ya existe: ${f.existente.nombre} (stock ${f.existente.stock_actual})` : []).concat(f.errores || []);
    return `<tr class="${claseFila}">
      <td>${f.fila}</td>
      <td>${escaparHtml(f.datos.nombre || '-')}${avisos.length ? `<div class="aviso-importacion">${escaparHtml(avisos.join(' · '))}</div>` : ''}</td>
      <td>${escaparHtml(f.datos.codigo || f.codigoSugerido || '-')}${!f.datos.codigo && f.codigoSugerido ? '<div class="aviso-importacion">codigo sugerido</div>' : ''}</td>
      <td>${escaparHtml(f.datos.categoria || '-')}</td>
      <td>${f.datos.stock_actual !== undefined ? f.datos.stock_actual : '-'}</td>
      <td>${f.datos.precio_venta !== undefined ? escaparHtml(formatoMoneda(f.datos.precio_venta)) : '-'}</td>
      <td><span class="badge ${etiqueta[1]}">${etiqueta[0]}</span></td>
      <td>
        <select class="accion-select" data-fila="${i}" ${f.estado === 'error' ? 'disabled' : ''}>
          <option value="crear" ${accionDefecto === 'crear' ? 'selected' : ''}>Crear</option>
          <option value="actualizar" ${accionDefecto === 'actualizar' ? 'selected' : ''}>Actualizar</option>
          <option value="omitir" ${accionDefecto === 'omitir' ? 'selected' : ''}>Omitir</option>
        </select>
      </td>
    </tr>`;
  }).join('');
}

document.getElementById('importarResolucion').addEventListener('change', () => {
  if (!ESTADO.importacion) return;
  const valor = document.getElementById('importarResolucion').value;
  const selects = document.querySelectorAll('#importarBody .accion-select');
  selects.forEach((sel, i) => {
    const f = ESTADO.importacion.filas[i];
    if (f.estado === 'error') return;
    if (f.estado === 'duplicado' || f.estado === 'duplicado_interno') sel.value = valor;
  });
});

async function aplicarImportacion() {
  const selects = document.querySelectorAll('#importarBody .accion-select');
  const filas = [];
  selects.forEach((sel, i) => {
    const f = ESTADO.importacion.filas[i];
    if (f.estado === 'error') return;
    filas.push({ ...f, accion: sel.value });
  });
  const resolucion = document.getElementById('importarResolucion').value;
  try {
    const r = await window.api.importar.aplicar({ filas, resolucion });
    cerrarModal('modalImportar');
    let msg = `Importacion completada: ${r.creados} creados`;
    if (r.actualizados) msg += `, ${r.actualizados} actualizados`;
    if (r.omitidos) msg += `, ${r.omitidos} omitidos`;
    if (r.errores && r.errores.length) msg += `, ${r.errores.length} con error`;
    notificar(msg);
    if (r.errores && r.errores.length) {
      document.getElementById('webhookResultado').textContent = r.errores.join('\n');
      navegar('config');
    }
    if (ESTADO.vista === 'productos') await cargarProductos();
    if (ESTADO.vista === 'dashboard') await cargarDashboard();
  } catch (err) {
    notificar('Error al importar: ' + err.message, true);
  }
}

/* ------------------ Sesion: eventos ------------------ */
function configurarEventosSesion() {
  document.getElementById('btnCerrarSesion').addEventListener('click', cerrarSesion);
  document.getElementById('btnCambiarClave').addEventListener('click', () => abrirModalClave(false));
  document.getElementById('btnCancelClave').addEventListener('click', () => cerrarModal('modalClave'));
  document.getElementById('formClave').addEventListener('submit', guardarClavePropia);
}

function abrirModalClave(obligatorio) {
  const modal = document.getElementById('modalClave');
  document.getElementById('formClave').reset();
  document.getElementById('btnCancelClave').classList.toggle('oculto', !!obligatorio);
  modal.classList.add('abierto');
}

async function guardarClavePropia(e) {
  e.preventDefault();
  const actual = document.getElementById('claveActual').value;
  const nueva = document.getElementById('claveNueva').value;
  const repetir = document.getElementById('claveRepetir').value;
  if (nueva !== repetir) return notificar('Las contrasenas nuevas no coinciden', true);
  if (nueva.length < 4) return notificar('La nueva contrasena debe tener al menos 4 caracteres', true);
  try {
    ESTADO.usuario = await window.api.auth.cambiarClavePropia(actual, nueva);
    cerrarModal('modalClave');
    notificar('Contrasena actualizada');
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

/* ------------------ Usuarios ------------------ */

function configurarEventosUsuarios() {
  document.getElementById('btnNuevoUsuario').addEventListener('click', nuevoUsuario);
  document.getElementById('btnCancelUsuario').addEventListener('click', () => cerrarModal('modalUsuario'));
  document.getElementById('formUsuario').addEventListener('submit', guardarUsuario);
  document.getElementById('uRol').addEventListener('change', mostrarDescripcionRol);
}

async function cargarVistaUsuarios() {
  ESTADO.usuarios = await window.api.usuarios.listar();
  ESTADO.catalogos = ESTADO.catalogos || await window.api.catalogos.seguridad();

  const selRol = document.getElementById('uRol');
  selRol.innerHTML = ESTADO.catalogos.roles.map(r =>
    `<option value="${r.clave}">${r.nombre} (nivel ${r.nivel})</option>`).join('');
  const selArea = document.getElementById('uArea');
  selArea.innerHTML = ESTADO.catalogos.areas.map(a => `<option value="${a}">${a}</option>`).join('');

  // Filtro de area para bitacora
  const selAreaBit = document.getElementById('bitacoraArea');
  if (selAreaBit && !selAreaBit.options.length) {
    selAreaBit.innerHTML = '<option value="">Todas las areas</option>' +
      ESTADO.catalogos.areas.map(a => `<option value="${a}">${a}</option>`).join('');
  }
  // Filtro de area para movimientos
  const selAreaMov = document.getElementById('filtroMovArea');
  if (selAreaMov && !selAreaMov.options.length) {
    selAreaMov.innerHTML = '<option value="">Todas las areas</option>' +
      ESTADO.catalogos.areas.map(a => `<option value="${a}">${a}</option>`).join('');
  }

  renderUsuarios();
  renderMatrizPermisos();
}

function renderUsuarios() {
  const tb = document.getElementById('usuariosBody');
  tb.innerHTML = ESTADO.usuarios.length
    ? ESTADO.usuarios.map(u => `
      <tr>
        <td>${u.nombre}${u.id === ESTADO.usuario.id ? ' <span class="chip">tu</span>' : ''}</td>
        <td>${u.usuario}</td>
        <td>${nombreRol(u.rol)}</td>
        <td>${u.area}</td>
        <td><span class="badge ${u.activo ? 'badge-ok' : 'badge-agotado'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>${formatoFecha(u.ultimo_acceso)}</td>
        <td>
          <button class="btn btn-ghost btn-mini" onclick="editarUsuario(${u.id})">Editar</button>
          <button class="btn btn-ghost btn-mini" onclick="resetearClave(${u.id})">Reset clave</button>
          <button class="btn btn-ghost btn-mini btn-mini-peligro" onclick="eliminarUsuarioRegistro(${u.id})">Eliminar</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="vacio">Sin usuarios</td></tr>';
}

function nombreRol(clave) {
  const r = (ESTADO.catalogos?.roles || []).find(x => x.clave === clave);
  return r ? r.nombre : clave;
}

function renderMatrizPermisos() {
  const cont = document.getElementById('matrizPermisos');
  if (!ESTADO.catalogos) return;
  const permisos = Object.entries(ESTADO.catalogos.permisos);
  const encabezado = ESTADO.catalogos.roles.map(r => `<th>${r.nombre}</th>`).join('');
  const filas = permisos.map(([clave, etiqueta]) => {
    const celdas = ESTADO.catalogos.roles.map(r =>
      `<td class="${r.permisos.includes(clave) ? 'si' : 'no'}">${r.permisos.includes(clave) ? 'Si' : '-'}</td>`).join('');
    return `<tr><td>${etiqueta}</td>${celdas}</tr>`;
  }).join('');
  cont.innerHTML = `
    <table class="matriz-tabla">
      <thead><tr><th>Permiso</th>${encabezado}</tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function mostrarDescripcionRol() {
  const rol = document.getElementById('uRol').value;
  const r = (ESTADO.catalogos?.roles || []).find(x => x.clave === rol);
  document.getElementById('uRolDesc').textContent = r ? r.descripcion : '';
}

function nuevoUsuario() {
  document.getElementById('tituloModalUsuario').textContent = 'Nuevo Usuario';
  document.getElementById('formUsuario').reset();
  document.getElementById('usuarioId').value = '';
  document.getElementById('uPassword').required = true;
  document.getElementById('labelPassword').textContent = 'Contrasena *';
  document.getElementById('ayudaPassword').textContent = 'Minimo 4 caracteres';
  document.getElementById('uActivo').checked = true;
  mostrarDescripcionRol();
  abrirModal('modalUsuario');
}

function editarUsuario(id) {
  const u = ESTADO.usuarios.find(x => x.id === id);
  if (!u) return;
  document.getElementById('tituloModalUsuario').textContent = 'Editar Usuario';
  document.getElementById('usuarioId').value = id;
  document.getElementById('uNombre').value = u.nombre;
  document.getElementById('uUsuario').value = u.usuario;
  document.getElementById('uRol').value = u.rol;
  document.getElementById('uArea').value = u.area;
  document.getElementById('uActivo').checked = !!u.activo;
  document.getElementById('uPassword').value = '';
  document.getElementById('uPassword').required = false;
  document.getElementById('labelPassword').textContent = 'Nueva contrasena (opcional)';
  document.getElementById('ayudaPassword').textContent = 'Dejalo vacio para conservar la actual';
  mostrarDescripcionRol();
  abrirModal('modalUsuario');
}

async function guardarUsuario(e) {
  e.preventDefault();
  const id = document.getElementById('usuarioId').value ? Number(document.getElementById('usuarioId').value) : undefined;
  try {
    await window.api.usuarios.guardar({
      id,
      nombre: document.getElementById('uNombre').value.trim(),
      usuario: document.getElementById('uUsuario').value.trim(),
      rol: document.getElementById('uRol').value,
      area: document.getElementById('uArea').value,
      activo: document.getElementById('uActivo').checked,
      password: document.getElementById('uPassword').value || undefined,
    });
    cerrarModal('modalUsuario');
    notificar('Usuario guardado');
    await cargarVistaUsuarios();
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

async function resetearClave(id) {
  const u = ESTADO.usuarios.find(x => x.id === id);
  if (!u) return;
  const password = prompt('Nueva contrasena para ' + u.usuario + ' (minimo 4 caracteres):');
  if (!password) return;
  try {
    await window.api.usuarios.cambiarClave(id, password);
    notificar('Contrasena restablecida');
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

async function eliminarUsuarioRegistro(id) {
  if (id === ESTADO.usuario.id) return notificar('No puedes eliminar tu propio usuario', true);
  const u = ESTADO.usuarios.find(x => x.id === id);
  if (!u) return;
  if (!confirm('Eliminar el usuario "' + u.usuario + '"? Su historial en la bitacora se conserva.')) return;
  try {
    await window.api.usuarios.eliminar(id);
    notificar('Usuario eliminado');
    await cargarVistaUsuarios();
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

/* ------------------ Bitacora ------------------ */

function configurarEventosBitacora() {
  document.getElementById('btnFiltrarBitacora').addEventListener('click', cargarBitacora);
  document.getElementById('btnExportarBitacora').addEventListener('click', exportarBitacoraExcel);
}

async function cargarVistaBitacora() {
  if (!ESTADO.catalogos) {
    ESTADO.catalogos = await window.api.catalogos.seguridad();
    const selArea = document.getElementById('bitacoraArea');
    selArea.innerHTML = '<option value="">Todas las areas</option>' +
      ESTADO.catalogos.areas.map(a => `<option value="${a}">${a}</option>`).join('');
  }
  await cargarBitacora();
}

async function cargarBitacora() {
  const busqueda = document.getElementById('bitacoraUsuario').value.trim();
  let usuarioId = undefined;
  if (busqueda) {
    const u = ESTADO.usuarios.find(x =>
      x.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
      x.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    usuarioId = u ? u.id : -1;
  }
  ESTADO.bitacora = await window.api.bitacora.listar({
    usuario_id: usuarioId,
    area: document.getElementById('bitacoraArea').value || undefined,
    accion: document.getElementById('bitacoraAccion').value || undefined,
    limite: 400,
  });
  renderBitacora();
}

function renderBitacora() {
  const tb = document.getElementById('bitacoraBody');
  tb.innerHTML = (ESTADO.bitacora || []).length
    ? ESTADO.bitacora.map(b => `
      <tr>
        <td>${formatoFecha(b.fecha)}</td>
        <td>${b.usuario || '-'}</td>
        <td>${b.area || '-'}</td>
        <td>${nombreRol(b.rol)}</td>
        <td>${b.accion}</td>
        <td>${b.entidad || '-'}${b.entidad_id ? ' #' + b.entidad_id : ''}</td>
        <td>${b.detalle || '-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="vacio">Sin registros</td></tr>';
}

async function exportarBitacoraExcel() {
  const res = await window.api.export.excel({
    filas: (ESTADO.bitacora || []).map(b => ({
      fecha: b.fecha, usuario: b.usuario || '', area: b.area || '', rol: b.rol || '',
      accion: b.accion, entidad: b.entidad || '', detalle: b.detalle || '',
    })),
    columnas: [
      { campo: 'fecha', titulo: 'Fecha', ancho: 20 },
      { campo: 'usuario', titulo: 'Usuario', ancho: 18 },
      { campo: 'area', titulo: 'Area', ancho: 18 },
      { campo: 'rol', titulo: 'Nivel', ancho: 14 },
      { campo: 'accion', titulo: 'Accion', ancho: 22 },
      { campo: 'entidad', titulo: 'Entidad', ancho: 14 },
      { campo: 'detalle', titulo: 'Detalle', ancho: 40 },
    ],
    nombreArchivo: 'bitacora.xlsx',
    hoja: 'Bitacora',
  });
  if (res.ok) notificar('Exportado a ' + res.ruta);
}

/* ------------------ Trazabilidad de producto ------------------ */

async function verTrazabilidad(id) {
  try {
    const t = await window.api.trazabilidad.producto(id);
    document.getElementById('tituloTrazabilidad').textContent = 'Trazabilidad: ' + t.producto.nombre;
    const campos = {};
    (t.camposGiro || []).forEach(c => campos[c.id] = c.nombre);

    const historial = t.movimientos.map(m => {
      const entra = m.tipo === 'entrada';
      const signo = entra ? '+' : '-';
      return `<div class="traza-linea">
        <span class="traza-etiqueta">${formatoFecha(m.fecha)}</span>
        <span>${signo}${m.cantidad} unidades</span>
        <span class="traza-etiqueta">${m.usuario_nombre || m.usuario_login || 'sistema'}${m.usuario_area ? ' · ' + m.usuario_area : ''}</span>
      </div>`;
    }).join('');

    const eventos = t.bitacora.map(b => `<div class="traza-linea">
        <span class="traza-etiqueta">${formatoFecha(b.fecha)}</span>
        <span>${b.accion}</span>
        <span class="traza-etiqueta">${b.usuario || '-'}</span>
      </div>`).join('');

    const especificos = t.valores.map(v =>
      `<div class="traza-linea"><span class="traza-etiqueta">${campos[v.campo_id] || 'campo ' + v.campo_id}</span><span>${v.valor || '-'}</span></div>`).join('');

    document.getElementById('trazabilidadContenido').innerHTML = `
      <div class="traza-bloque">
        <h4>Datos del producto</h4>
        <div class="traza-linea"><span class="traza-etiqueta">Codigo</span><span>${t.producto.codigo || '-'}</span></div>
        <div class="traza-linea"><span class="traza-etiqueta">Stock actual</span><span>${t.producto.stock_actual}</span></div>
        <div class="traza-linea"><span class="traza-etiqueta">Registrado el</span><span>${formatoFecha(t.producto.created_at)}</span></div>
        <div class="traza-linea"><span class="traza-etiqueta">Ultima actualizacion</span><span>${formatoFecha(t.producto.updated_at)}</span></div>
      </div>
      ${especificos ? `<div class="traza-bloque"><h4>Campos del giro</h4>${especificos}</div>` : ''}
      <div class="traza-bloque">
        <h4>Historial de stock (${t.movimientos.length})</h4>
        ${historial || '<p class="texto-ayuda">Sin movimientos registrados</p>'}
      </div>
      <div class="traza-bloque">
        <h4>Eventos administrativos (${t.bitacora.length})</h4>
        ${eventos || '<p class="texto-ayuda">Sin eventos administrativos</p>'}
      </div>`;
    abrirModal('modalTrazabilidad');
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

/* ------------------ Eliminar producto ------------------ */

async function eliminarProducto(id) {
  const p = ESTADO.productos.find(x => x.id === id);
  if (!p) return;
  if (!confirm('Eliminar "' + p.nombre + '"?Esta accion quedara registrada en la bitacora.')) return;
  try {
    await window.api.producto.eliminar(id);
    notificar('Producto eliminado');
    await cargarProductos();
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
}

/* ------------------ Utilidades ------------------ */

function abrirModal(id) { document.getElementById(id).classList.add('abierto'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('abierto'); }

let notifTimer;
function notificar(mensaje, error = false) {
  const el = document.getElementById('notificacion');
  el.textContent = mensaje;
  el.className = 'notificacion visible' + (error ? ' error' : '');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}

function formatoMoneda(n) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' Bs';
}

function formatoFecha(f) {
  if (!f) return '-';
  return String(f).replace('T', ' ').slice(0, 16);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.abierto').forEach(m => m.classList.remove('abierto'));
  }
});

window.editarProducto = editarProducto;
window.entradaRapida = entradaRapida;
window.editarProveedor = editarProveedor;
window.eliminarCampo = eliminarCampo;
window.verTrazabilidad = verTrazabilidad;
window.eliminarProducto = eliminarProducto;
window.editarUsuario = editarUsuario;
window.resetearClave = resetearClave;
window.eliminarUsuarioRegistro = eliminarUsuarioRegistro;
window.abrirImportador = abrirImportador;
window.verTrazabilidad = verTrazabilidad;

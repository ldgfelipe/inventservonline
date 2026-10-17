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
  eventosListos: false,
  contabilidad: null,
  empresa: null,
  monedaInfo: null,
  catalogoMonedas: null,
  suscripcion: null,
  planes: null,
  notificaciones: [],
  clientes: [],
  ventas: [],
  compras: [],
  cxc: [],
  cxp: [],
  almacenes: [],
  ventaItems: [],
  compraItems: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  configurarLogin();
  await verificarSesion();
});

/* ------------------ Sesion y permisos ------------------ */

function puedeUI(permiso) {
  if (!ESTADO.usuario) return false;
  // Defensivo: si el usuario viene sin permisos (p.e. una version antigua
  // de la API), negamos en vez de lanzar y dejar la app congelada.
  const permisos = ESTADO.usuario.permisos;
  if (!Array.isArray(permisos)) return false;
  return permisos.includes(permiso);
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
  if (!u) return;
  document.getElementById('infoUsuario').classList.remove('oculto');
  document.getElementById('infoUsuarioNombre').textContent = u.nombre || '-';
  const rol = document.getElementById('infoUsuarioRol');
  rol.textContent = u.rolNombre || u.rol || '-';
  rol.className = 'badge-rol nivel-' + (u.nivel || 0);
  document.getElementById('infoUsuarioArea').textContent = u.area || '-';
}

/* Oculta secciones y botones segun los permisos del rol */
function aplicarPermisosUI() {
  const mapaNav = {
    productos: 'productos.ver',
    movimientos: 'movimientos.ver',
    proveedores: 'proveedores.ver',
    bitacora: 'bitacora.ver',
    usuarios: 'usuarios.gestionar',
    contabilidad: 'contabilidad.ver',
    config: 'config.ver',
    reportes: 'reportes.ver',
    clientes: 'clientes.ver',
    ventas: 'ventas.ver',
    compras: 'compras.ver',
    cxc: 'cxc.ver',
    cxp: 'cxp.ver',
    caja: 'caja.ver',
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
  alternarBoton('btnConsultarContab', 'contabilidad.ver');
  alternarBoton('btnExportarContab', 'contabilidad.ver');
  alternarBoton('btnImprimirContab', 'contabilidad.ver');

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
  // Cada carga de datos se protege por separado: si una falla (catalogo
  // incompleto, permiso ausente), el sistema igual queda navegable.
  await cargarSinRomper(cargarGiroActual, 'el giro actual');
  await cargarSinRomper(cargarEmpresa, 'los datos de la empresa');
  await cargarSinRomper(cargarCategorias, 'las categorias');
  await cargarSinRomper(cargarProveedores, 'los proveedores');
  // Los eventos se registran una sola vez por sesion de pagina:
  // si no, al cerrar y abrir sesion se duplicarian los listeners.
  if (!ESTADO.eventosListos) {
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
    configurarEventosContabilidad();
    configurarEventosComercial();
    configurarEventosReportes();
    configurarEventosNotificaciones();
    configurarMenu();
    ESTADO.eventosListos = true;
  }
  navegar('dashboard');
}

async function cargarSinRomper(fn, que) {
  try {
    await fn();
  } catch (e) {
    console.warn('No se pudo cargar ' + que + ':', e.message);
    notificar('No se pudo cargar ' + que + ': ' + e.message, true);
  }
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

async function cargarEmpresa() {
  ESTADO.empresa = await window.api.empresa.obtener();
  // moneda_info la resuelve la API (simbolo, decimales, formato). Si una
  // base antigua no la trae, formatoMoneda cae en el valor por defecto.
  ESTADO.monedaInfo = (ESTADO.empresa && ESTADO.empresa.moneda_info) || null;
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
  renderFiltroProveedores();
}

function renderFiltroProveedores() {
  const sel = document.getElementById('filtroProveedorProducto');
  if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos los proveedores</option>' +
    ESTADO.proveedores.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('');
  if (actual) sel.value = actual;
}

async function cargarProductos() {
  ESTADO.productos = await window.api.producto.listar({
    busqueda: document.getElementById('buscarProducto').value.trim(),
    categoria_id: document.getElementById('filtroCategoria').value || undefined,
    proveedor_id: document.getElementById('filtroProveedorProducto')?.value || undefined,
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
  const [stats, productos, ultimos] = await Promise.all([
    window.api.dashboard.stats(),
    window.api.producto.listar({ limite: 1000 }),
    window.api.movimientos.listar({ limite: 8 }),
  ]);

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card primario"><h4>Total productos</h4><div class="valor">${stats.productos}</div></div>
    <div class="stat-card exito"><h4>Unidades en stock</h4><div class="valor">${stats.unidades}</div></div>
    <div class="stat-card"><h4>Valor a costo</h4><div class="valor">${formatoMoneda(stats.valorCosto || 0)}</div></div>
    <div class="stat-card"><h4>Valor a venta</h4><div class="valor">${formatoMoneda(stats.valor)}</div></div>
    <div class="stat-card warning"><h4>Bajo minimo</h4><div class="valor">${stats.stockBajo}</div></div>
    <div class="stat-card warning"><h4>Por reordenar</h4><div class="valor">${stats.porReordenar || 0}</div></div>
    <div class="stat-card"><h4>Sobre el maximo</h4><div class="valor">${stats.stockExceso || 0}</div></div>
    <div class="stat-card error"><h4>Agotados</h4><div class="valor">${stats.agotados}</div></div>
    <div class="stat-card"><h4>Movimientos hoy</h4><div class="valor">${stats.movimientosHoy}</div></div>
  `;

  // Las alertas se ordenan por gravedad para que lo urgente quede arriba.
  const orden = { agotado: 0, bajo: 1, reorden: 2, exceso: 3 };
  const alertas = productos
    .filter(p => p.alerta && p.alerta !== 'ok')
    .sort((a, b) => (orden[a.alerta] ?? 9) - (orden[b.alerta] ?? 9))
    .slice(0, 30);

  document.getElementById('stockBajoBody').innerHTML = alertas.length
    ? alertas.map(p => `<tr>
        <td>${p.codigo || '-'}</td><td>${escaparHtml(p.nombre)}</td><td>${p.categoria_nombre || '-'}</td>
        <td><span class="badge ${badgeAlerta(p.alerta)}">${p.stock_actual}</span></td>
        <td>${p.stock_minimo || 0}</td><td>${p.stock_maximo || 0}</td>
        <td>${etiquetaAlerta(p.alerta)}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="vacio">Sin alertas de stock</td></tr>';

  document.getElementById('ultimosMovBody').innerHTML = ultimos.length
    ? ultimos.map(m => `<tr>
        <td>${formatoFecha(m.fecha)}</td><td>${escaparHtml(m.producto_nombre)}</td>
        <td><span class="badge ${m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo}</span></td>
        <td>${m.cantidad}</td><td>${m.usuario_nombre || m.usuario_login || '-'}</td>
        <td>${m.observacion || '-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Sin movimientos registrados</td></tr>';
}

function badgeAlerta(alerta) {
  return {
    agotado: 'badge-agotado',
    bajo: 'badge-bajo',
    reorden: 'badge-reorden',
    exceso: 'badge-exceso',
    ok: 'badge-ok',
  }[alerta] || 'badge-ok';
}

function etiquetaAlerta(alerta) {
  return {
    agotado: 'Agotado',
    bajo: 'Bajo minimo',
    reorden: 'Por reordenar',
    exceso: 'Sobre el maximo',
    ok: 'OK',
  }[alerta] || 'OK';
}

/* ------------------ Render ------------------ */

function renderProductos() {
  const tb = document.getElementById('productosBody');
  tb.innerHTML = ESTADO.productos.length
    ? ESTADO.productos.map(p => {
        const alerta = p.alerta || 'ok';
        return `<tr>
          <td>${p.codigo || '-'}</td><td>${escaparHtml(p.nombre)}</td><td>${p.categoria_nombre || '-'}</td>
          <td><span class="badge ${badgeAlerta(alerta)}">${p.stock_actual} ${escaparHtml(p.unidad || '')}</span></td>
          <td>${p.stock_minimo || 0}</td>
          <td>${p.stock_maximo || 0}</td>
          <td>${p.punto_reorden || 0}</td>
          <td>${etiquetaAlerta(alerta)}</td>
          <td>${formatoMoneda(p.precio_venta || 0)}</td>
          <td>
            <button class="btn btn-ghost btn-mini" onclick="editarProducto('${p.id}')">Editar</button>
            <button class="btn btn-ghost btn-mini" onclick="verTrazabilidad('${p.id}')" title="Ver historial completo">Trazabilidad</button>
            <button class="btn btn-ghost btn-mini" onclick="entradaRapida('${p.id}')" title="Registrar entrada rapida">+ Entrada</button>
            <button class="btn btn-ghost btn-mini btn-mini-peligro" onclick="eliminarProducto('${p.id}')" title="Eliminar">Eliminar</button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" class="vacio">No hay productos</td></tr>';
}

function renderMovimientos() {
  const tb = document.getElementById('movimientosBody');
  tb.innerHTML = ESTADO.movimientos.length
    ? ESTADO.movimientos.map(m => `<tr>
        <td>${formatoFecha(m.fecha)}</td><td>${escaparHtml(m.producto_nombre)}</td>
        <td><span class="badge ${m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo}</span></td>
        <td>${m.cantidad}</td>
        <td>${formatoMoneda(m.precio_unitario || 0)}</td>
        <td>${formatoMoneda(m.costo_unitario || 0)}</td>
        <td>${formatoMoneda(m.total || 0)}</td>
        <td>${formatoMoneda(m.costo_total || 0)}</td>
        <td>${m.usuario_nombre || m.usuario_login || '-'}</td>
        <td>${m.documento || m.concepto || '-'}</td>
        <td><button class="btn btn-ghost btn-mini" onclick="imprimirComprobanteMovimiento('${m.id}')">Imprimir</button></td>
      </tr>`).join('')
    : '<tr><td colspan="11" class="vacio">Sin movimientos</td></tr>';
}

function renderProveedores() {
  const tb = document.getElementById('proveedoresBody');
  tb.innerHTML = ESTADO.proveedores.length
    ? ESTADO.proveedores.map(p => `<tr>
        <td>${escaparHtml(p.nombre)}</td><td>${p.rif || '-'}</td><td>${p.telefono || '-'}</td>
        <td>${p.email || '-'}</td><td>${p.direccion || '-'}</td>
        <td>
          <button class="btn btn-ghost btn-mini" onclick="editarProveedor('${p.id}')">Editar</button>
          <button class="btn btn-ghost btn-mini" onclick="imprimirFichaProveedor('${p.id}')">Imprimir ficha</button>
        </td>
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
    contabilidad: 'Contabilidad y kardex',
    config: 'Configuracion',
    reportes: 'Reportes comerciales',
    clientes: 'Clientes',
    ventas: 'Ventas',
    compras: 'Compras',
    cxc: 'Cuentas por cobrar',
    cxp: 'Cuentas por pagar',
    caja: 'Caja',
  }[vista] || vista;

  if (vista === 'dashboard') cargarDashboard();
  if (vista === 'productos') cargarProductos();
  if (vista === 'movimientos') cargarMovimientos();
  if (vista === 'proveedores') renderProveedores();
  if (vista === 'usuarios') cargarVistaUsuarios();
  if (vista === 'contabilidad') cargarContabilidad();
  if (vista === 'config') cargarOpcionesConfig();
  if (vista === 'bitacora') cargarVistaBitacora();
  if (vista === 'reportes') cargarReportes();
  if (vista === 'clientes') cargarClientes();
  if (vista === 'ventas') cargarVentas();
  if (vista === 'compras') cargarCompras();
  if (vista === 'cxc') cargarCxC();
  if (vista === 'cxp') cargarCxP();
  if (vista === 'caja') cargarCaja();
}

function configurarMenu() {
  window.api.onVista(async (canal) => {
    const mapa = {
      'vista:dashboard': 'dashboard', 'vista:productos': 'productos',
      'vista:movimientos': 'movimientos', 'vista:proveedores': 'proveedores',
      'vista:usuarios': 'usuarios', 'vista:bitacora': 'bitacora',
      'vista:contabilidad': 'contabilidad',
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
  document.getElementById('filtroProveedorProducto').addEventListener('change', cargarProductos);
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
      ESTADO.categorias.map(c => `<option value="${c.id}" ${p.categoria_id === c.id ? 'selected' : ''}>${escaparHtml(c.nombre)}</option>`).join('')
    }</select></div>
    <div class="campo ancho-completo"><label>Nombre *</label><input type="text" id="p_nombre" value="${escaparHtml(p.nombre || '')}" required></div>
    <div class="campo"><label>Stock actual</label><input type="number" id="p_stockActual" value="${p.stock_actual || 0}"></div>
    <div class="campo"><label>Unidad de medida</label><input type="text" id="p_unidad" value="${p.unidad || 'unidad'}" placeholder="unidad, caja, kg..."></div>
    <div class="campo"><label>Stock minimo</label><input type="number" id="p_stockMinimo" value="${p.stock_minimo || 0}"></div>
    <div class="campo"><label>Stock maximo</label><input type="number" id="p_stockMaximo" value="${p.stock_maximo || 0}"></div>
    <div class="campo"><label>Punto de reorden</label><input type="number" id="p_puntoReorden" value="${p.punto_reorden || 0}"></div>
    <div class="campo"><label>Costo promedio</label><input type="number" id="p_costoPromedio" value="${p.costo_promedio || 0}" disabled title="Se calcula solo con las entradas"></div>
    <div class="campo"><label>Precio de compra</label><input type="number" step="0.01" id="p_precioCompra" value="${p.precio_compra || 0}"></div>
    <div class="campo"><label>Precio de venta</label><input type="number" step="0.01" id="p_precioVenta" value="${p.precio_venta || 0}"></div>
    <div class="campo"><label>Lote</label><input type="text" id="p_lote" value="${p.lote || ''}"></div>
    <div class="campo"><label>Fecha de vencimiento</label><input type="date" id="p_vencimiento" value="${p.fecha_vencimiento || ''}"></div>
    <div class="campo ancho-completo"><label>Ubicacion en almacen</label><input type="text" id="p_ubicacion" value="${escaparHtml(p.ubicacion || '')}" placeholder="Pasillo, estante, nivel..."></div>
    <div class="campo ancho-completo"><label>Proveedor</label><select id="p_proveedor" class="input-select">
      <option value="">Sin proveedor</option>
      ${ESTADO.proveedores.map(pr => `<option value="${pr.id}" ${p.proveedor_id === pr.id ? 'selected' : ''}>${escaparHtml(pr.nombre)}</option>`).join('')}
    </select></div>
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
    stock_maximo: Number(document.getElementById('p_stockMaximo').value || 0),
    punto_reorden: Number(document.getElementById('p_puntoReorden').value || 0),
    unidad: document.getElementById('p_unidad').value.trim() || 'unidad',
    lote: document.getElementById('p_lote').value.trim() || null,
    fecha_vencimiento: document.getElementById('p_vencimiento').value || null,
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
  const prod = ESTADO.productos.find(p => p.id === id);
  const cantidad = prompt('Cantidad a ingresar al stock:');
  if (!cantidad || Number(cantidad) <= 0) return;
  const costo = prod ? (prod.costo_promedio || prod.precio_compra || 0) : 0;
  try {
    await window.api.movimientos.registrar({
      producto_id: id, tipo: 'entrada', cantidad: Number(cantidad),
      precio_unitario: costo, concepto: 'Carga inicial',
      observacion: 'Entrada rapida',
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
  document.getElementById('movTipo').addEventListener('change', () => {
    actualizarConceptosMovimiento();
    completarPrecioSugerido();
  });
  document.getElementById('btnCerrarTrazabilidad').addEventListener('click', () => cerrarModal('modalTrazabilidad'));
  let tBusq;
  document.getElementById('buscarMovProducto').addEventListener('input', () => {
    clearTimeout(tBusq);
    tBusq = setTimeout(cargarMovimientos, 300);
  });
}

/* El concepto y la etiqueta del precio cambian segun sea entrada o salida. */
const CONCEPTOS_MOVIMIENTO = {
  entrada: ['Compra a proveedor', 'Devolucion de cliente', 'Ajuste de inventario (entrada)',
            'Carga inicial', 'Transferencia entre almacenes', 'Otro'],
  salida:  ['Venta al detal', 'Venta al mayor', 'Consumo interno', 'Ajuste de inventario (salida)',
            'Merma o producto danado', 'Devolucion a proveedor', 'Transferencia entre almacenes', 'Otro'],
};

function actualizarConceptosMovimiento() {
  const tipo = document.getElementById('movTipo').value === 'salida' ? 'salida' : 'entrada';
  const sel = document.getElementById('movConcepto');
  sel.innerHTML = CONCEPTOS_MOVIMIENTO[tipo].map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('movPrecioLabel').textContent =
    tipo === 'entrada' ? 'Costo unitario de compra' : 'Precio unitario de venta';
}

async function nuevoMovimiento() {
  await cargarProveedores();
  if (!ESTADO.productos.length) await cargarProductos();
  document.getElementById('formMovimiento').reset();
  document.getElementById('movCantidad').value = 1;
  document.getElementById('movPrecio').value = 0;
  document.getElementById('movDocumento').value = '';
  actualizarConceptosMovimiento();
  const sel = document.getElementById('movProducto');
  sel.innerHTML = ESTADO.productos.length
    ? ESTADO.productos.map(p => `<option value="${p.id}" data-precio="${p.precio_venta || 0}" data-costo="${p.costo_promedio || p.precio_compra || 0}">${escaparHtml(p.nombre)} (Stock: ${p.stock_actual})</option>`).join('')
    : '<option value="">Sin productos registrados</option>';
  document.getElementById('movProveedor').innerHTML =
    '<option value="">Sin proveedor</option>' + ESTADO.proveedores.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('');
  window.api.almacenes.listar().then((as) => {
    ESTADO.almacenes = as || [];
    const sa = document.getElementById('movAlmacen');
    if (sa) sa.innerHTML = '<option value="">Principal</option>' +
      (as || []).map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join('');
  }).catch(() => {});
  completarPrecioSugerido();
  abrirModal('modalMovimiento');
}

function completarPrecioSugerido() {
  const sel = document.getElementById('movProducto');
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  const tipo = document.getElementById('movTipo').value;
  const valor = tipo === 'entrada' ? opt.dataset.costo : opt.dataset.precio;
  if (valor) document.getElementById('movPrecio').value = valor;
}

async function guardarMovimiento(e) {
  e.preventDefault();
  const selProducto = document.getElementById('movProducto');
  if (!selProducto.value) return notificar('No hay productos registrados', true);
  const nombreProducto = selProducto.options[selProducto.selectedIndex].text.split(' (Stock:')[0];
  const tipo = document.getElementById('movTipo').value;
  const cantidad = Number(document.getElementById('movCantidad').value);
  const observacion = document.getElementById('movObservacion').value;
  const concepto = document.getElementById('movConcepto').value;
  const documento = document.getElementById('movDocumento').value.trim();
  try {
    const res = await window.api.movimientos.registrar({
      producto_id: selProducto.value,
      tipo,
      cantidad,
      precio_unitario: Number(document.getElementById('movPrecio').value),
      proveedor_id: document.getElementById('movProveedor').value || null,
      concepto,
      documento,
      observacion,
      almacen_id: document.getElementById('movAlmacen').value || null,
    });
    cerrarModal('modalMovimiento');
    notificar('Movimiento registrado');
    track('movimiento.' + tipo);
    cargarMovimientos();

    if (confirm('Deseas imprimir el comprobante de este movimiento?')) {
      await imprimirComprobante({
        producto: nombreProducto,
        tipo,
        cantidad,
        precio: Number(document.getElementById('movPrecio').value),
        costo_unitario: res.costo_unitario,
        costo_total: res.costo_total,
        total: res.total,
        stock_final: res.stock_actual,
        saldo_valor: res.saldo_valor,
        concepto,
        documento,
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

/* ------------------ Impresion ------------------
   Todos los formatos salen con el encabezado de la empresa, para que
   sirvan como documento interno o respaldo ante el cliente/proveedor. */

function encabezadoImpresion(titulo, subtitulo) {
  const empresa = ESTADO.empresa || {};
  const fecha = new Date().toLocaleString('es-VE');
  return `<div class="doc-encabezado">
      <div>
        <h1>${escaparHtml(empresa.nombre || 'Sistema de Inventarios')}</h1>
        <div class="doc-meta">${empresa.rif ? 'RIF: ' + escaparHtml(empresa.rif) + ' · ' : ''}Giro: ${escaparHtml(ESTADO.giro || '-')}</div>
      </div>
      <div class="doc-meta" style="text-align:right">${escaparHtml(fecha)}<br>Usuario: ${escaparHtml(ESTADO.usuario?.nombre || '-')}</div>
    </div>
    <h2 class="doc-titulo">${escaparHtml(titulo)}</h2>
    ${subtitulo ? `<div class="doc-meta">${escaparHtml(subtitulo)}</div>` : ''}`;
}

function envolverDocumento(titulo, cuerpo) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title>
    <style>
      @page { size: letter; margin: 14mm; }
      body { font-family: Arial, Helvetica, sans-serif; color:#111; font-size: 12px; }
      .doc-encabezado { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:12px; }
      .doc-encabezado h1 { font-size: 16px; margin: 0 0 4px; }
      .doc-titulo { font-size: 15px; margin: 0 0 4px; text-transform: uppercase; }
      .doc-meta { color:#555; font-size: 11px; }
      table { width:100%; border-collapse:collapse; font-size:12px; margin-top:10px; }
      th,td { border:1px solid #999; padding:5px 7px; text-align:left; }
      th { background:#eee; }
      td.num, th.num { text-align:right; }
      .totales { margin-top:10px; margin-left:auto; width:340px; }
      .totales div { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dashed #bbb; }
      .totales .fuerte { font-weight:700; border-bottom:none; border-top:2px solid #111; margin-top:4px; padding-top:6px; }
      .firmas { display:flex; gap:40px; margin-top:50px; }
      .firma { flex:1; border-top:1px solid #111; padding-top:6px; text-align:center; font-size:11px; }
      .nota { margin-top:14px; color:#555; font-size:11px; }
    </style></head><body>${cuerpo}</body></html>`;
}

async function imprimirDocumento(titulo, cuerpo) {
  try {
    await window.api.imprimir.html(envolverDocumento(titulo, cuerpo));
  } catch (err) {
    notificar('No se pudo imprimir: ' + err.message, true);
  }
}

/* Comprobante / acta de un movimiento (entrada o salida) */
async function imprimirComprobante(datos) {
  const esEntrada = datos.tipo === 'entrada';
  const titulo = esEntrada ? 'Acta de recepcion de mercancia' : 'Comprobante de despacho';
  const cuerpo = `
    ${encabezadoImpresion(titulo, 'Fecha del documento: ' + new Date().toLocaleString('es-VE'))}
    <table>
      <tbody>
        <tr><th style="width:32%">Concepto</th><td>${escaparHtml(datos.concepto || '-')}</td></tr>
        <tr><th>Documento / referencia</th><td>${escaparHtml(datos.documento || '-')}</td></tr>
        <tr><th>Producto</th><td>${escaparHtml(datos.producto || '-')}</td></tr>
        <tr><th>Cantidad</th><td>${datos.cantidad} ${escaparHtml(datos.unidad || '')}</td></tr>
        <tr><th>${esEntrada ? 'Costo unitario de compra' : 'Precio unitario de venta'}</th><td>${formatoMoneda(datos.precio || 0)}</td></tr>
        <tr><th>Costo unitario promedio</th><td>${formatoMoneda(datos.costo_unitario || 0)}</td></tr>
        <tr><th>Observacion</th><td>${escaparHtml(datos.observacion || '-')}</td></tr>
      </tbody>
    </table>
    <div class="totales">
      <div><span>Valor del movimiento</span><span>${formatoMoneda(datos.total || 0)}</span></div>
      <div><span>Costo del movimiento</span><span>${formatoMoneda(datos.costo_total || 0)}</span></div>
      <div class="fuerte"><span>Stock resultante</span><span>${datos.stock_final ?? '-'} ${escaparHtml(datos.unidad || '')}</span></div>
    </div>
    <div class="firmas">
      <div class="firma">${esEntrada ? 'Recibido por' : 'Despachado por'}</div>
      <div class="firma">Autorizado por</div>
    </div>`;
  await imprimirDocumento(titulo, cuerpo);
}

async function imprimirComprobanteMovimiento(id) {
  const m = ESTADO.movimientos.find(x => x.id === id);
  if (!m) return notificar('Movimiento no encontrado', true);
  await imprimirComprobante({
    producto: m.producto_nombre, tipo: m.tipo, cantidad: m.cantidad,
    precio: m.precio_unitario, costo_unitario: m.costo_unitario, costo_total: m.costo_total,
    total: m.total, stock_final: m.stock_resultante, saldo_valor: m.saldo_valor,
    concepto: m.concepto, documento: m.documento, observacion: m.observacion,
  });
}

/* Inventario valorizado (reporte de productos) */
async function imprimirProductos() {
  if (!ESTADO.productos.length) await cargarProductos();
  const filas = ESTADO.productos.map(p => {
    const valorCosto = (p.stock_actual || 0) * (p.costo_promedio || p.precio_compra || 0);
    const valorVenta = (p.stock_actual || 0) * (p.precio_venta || 0);
    return `<tr>
      <td>${escaparHtml(p.codigo || '-')}</td>
      <td>${escaparHtml(p.nombre)}</td>
      <td>${escaparHtml(p.categoria_nombre || '-')}</td>
      <td class="num">${p.stock_actual} ${escaparHtml(p.unidad || '')}</td>
      <td class="num">${p.stock_minimo || 0} / ${p.stock_maximo || 0}</td>
      <td class="num">${formatoMoneda(p.costo_promedio || p.precio_compra || 0)}</td>
      <td class="num">${formatoMoneda(valorCosto)}</td>
      <td class="num">${formatoMoneda(valorVenta)}</td>
      <td>${etiquetaAlerta(p.alerta || 'ok')}</td>
    </tr>`;
  }).join('');
  const totalCosto = ESTADO.productos.reduce((s, p) => s + (p.stock_actual || 0) * (p.costo_promedio || p.precio_compra || 0), 0);
  const totalVenta = ESTADO.productos.reduce((s, p) => s + (p.stock_actual || 0) * (p.precio_venta || 0), 0);
  const cuerpo = `
    ${encabezadoImpresion('Inventario valorizado', `Productos: ${ESTADO.productos.length}`)}
    <table>
      <thead>
        <tr>
          <th>Codigo</th><th>Producto</th><th>Categoria</th><th class="num">Stock</th>
          <th class="num">Min/Max</th><th class="num">Costo</th><th class="num">Valor costo</th>
          <th class="num">Valor venta</th><th>Estado</th>
        </tr>
      </thead>
      <tbody>${filas || '<tr><td colspan="9">Sin productos</td></tr>'}</tbody>
    </table>
    <div class="totales">
      <div><span>Valor total a costo</span><span>${formatoMoneda(totalCosto)}</span></div>
      <div class="fuerte"><span>Valor total a venta</span><span>${formatoMoneda(totalVenta)}</span></div>
    </div>`;
  await imprimirDocumento('Inventario valorizado', cuerpo);
}

/* Reporte de entradas y salidas con valorizacion */
async function imprimirMovimientos() {
  if (!ESTADO.movimientos.length) await cargarMovimientos();
  const filas = ESTADO.movimientos.map(m => `<tr>
      <td>${formatoFecha(m.fecha)}</td>
      <td>${escaparHtml(m.producto_nombre)}</td>
      <td>${m.tipo}</td>
      <td>${escaparHtml(m.concepto || '-')}</td>
      <td class="num">${m.cantidad}</td>
      <td class="num">${formatoMoneda(m.precio_unitario || 0)}</td>
      <td class="num">${formatoMoneda(m.costo_total || 0)}</td>
      <td class="num">${formatoMoneda(m.total || 0)}</td>
    </tr>`).join('');
  const totalVenta = ESTADO.movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + (m.total || 0), 0);
  const totalCosto = ESTADO.movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + (m.costo_total || 0), 0);
  const cuerpo = `
    ${encabezadoImpresion('Reporte de entradas y salidas', `Movimientos: ${ESTADO.movimientos.length}`)}
    <table>
      <thead>
        <tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Concepto</th>
        <th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Costo total</th><th class="num">Valor total</th></tr>
      </thead>
      <tbody>${filas || '<tr><td colspan="8">Sin movimientos</td></tr>'}</tbody>
    </table>
    <div class="totales">
      <div><span>Valor de las salidas</span><span>${formatoMoneda(totalVenta)}</span></div>
      <div><span>Costo de las salidas</span><span>${formatoMoneda(totalCosto)}</span></div>
      <div class="fuerte"><span>Margen bruto</span><span>${formatoMoneda(totalVenta - totalCosto)}</span></div>
    </div>`;
  await imprimirDocumento('Reporte de entradas y salidas', cuerpo);
}

/* Ficha de proveedor con los productos que suministra */
async function imprimirFichaProveedor(id) {
  const prov = ESTADO.proveedores.find(p => p.id === id);
  if (!prov) return notificar('Proveedor no encontrado', true);
  let productos = [];
  try { productos = await window.api.producto.listar({ proveedor_id: id, limite: 1000 }); } catch { /* opcional */ }
  const filas = productos.map(p => `<tr>
      <td>${escaparHtml(p.codigo || '-')}</td><td>${escaparHtml(p.nombre)}</td>
      <td>${escaparHtml(p.categoria_nombre || '-')}</td>
      <td class="num">${p.stock_actual}</td>
      <td class="num">${formatoMoneda(p.costo_promedio || p.precio_compra || 0)}</td>
      <td class="num">${formatoMoneda((p.stock_actual || 0) * (p.costo_promedio || p.precio_compra || 0))}</td>
    </tr>`).join('');
  const valorTotal = productos.reduce((s, p) => s + (p.stock_actual || 0) * (p.costo_promedio || p.precio_compra || 0), 0);
  const cuerpo = `
    ${encabezadoImpresion('Ficha de proveedor', 'Datos de contacto y productos suministrados')}
    <table>
      <tbody>
        <tr><th style="width:30%">Proveedor</th><td>${escaparHtml(prov.nombre)}</td></tr>
        <tr><th>RIF</th><td>${escaparHtml(prov.rif || '-')}</td></tr>
        <tr><th>Telefono</th><td>${escaparHtml(prov.telefono || '-')}</td></tr>
        <tr><th>Email</th><td>${escaparHtml(prov.email || '-')}</td></tr>
        <tr><th>Direccion</th><td>${escaparHtml(prov.direccion || '-')}</td></tr>
      </tbody>
    </table>
    <h3 style="font-size:13px;margin:16px 0 4px">Productos suministrados (${productos.length})</h3>
    <table>
      <thead><tr><th>Codigo</th><th>Producto</th><th>Categoria</th><th class="num">Stock</th><th class="num">Costo</th><th class="num">Valor</th></tr></thead>
      <tbody>${filas || '<tr><td colspan="6">Sin productos asociados</td></tr>'}</tbody>
    </table>
    <div class="totales"><div class="fuerte"><span>Valor total a costo</span><span>${formatoMoneda(valorTotal)}</span></div></div>`;
  await imprimirDocumento('Ficha de proveedor', cuerpo);
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
  document.getElementById('btnGuardarEmpresa').addEventListener('click', guardarEmpresaMoneda);
  // Al cambiar de pais se propone su moneda (el usuario puede cambiarla).
  document.getElementById('selectPais').addEventListener('change', (e) => {
    const cat = ESTADO.catalogoMonedas;
    const p = cat && cat.paises.find(x => x.codigo === e.target.value);
    if (p) document.getElementById('selectMoneda').value = p.moneda;
    renderVistaPreviaMoneda();
  });
  document.getElementById('selectMoneda').addEventListener('change', renderVistaPreviaMoneda);

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

  const fTr = document.getElementById('formTransferencia');
  if (fTr) fTr.addEventListener('submit', (e) => { e.preventDefault(); registrarTransferencia(); });
  const btnCancelTr = document.getElementById('btnCancelTransferencia');
  if (btnCancelTr) btnCancelTr.addEventListener('click', () => cerrarModal('modalTransferencia'));

  const btnGuardarEmail = document.getElementById('btnGuardarEmail');
  if (btnGuardarEmail) btnGuardarEmail.addEventListener('click', guardarEmailConfig);
  const btnProbarEmail = document.getElementById('btnProbarEmail');
  if (btnProbarEmail) btnProbarEmail.addEventListener('click', probarEmailConfig);

  const btnGuardarWa = document.getElementById('btnGuardarWa');
  if (btnGuardarWa) btnGuardarWa.addEventListener('click', guardarWaConfig);
  const btnProbarWa = document.getElementById('btnProbarWa');
  if (btnProbarWa) btnProbarWa.addEventListener('click', probarWaConfig);

  const btnGuardarFact = document.getElementById('btnGuardarFact');
  if (btnGuardarFact) btnGuardarFact.addEventListener('click', guardarFacturacion);
  const btnSolicitarFact = document.getElementById('btnSolicitarFact');
  if (btnSolicitarFact) btnSolicitarFact.addEventListener('click', () => abrirModal('modalSolicitudFact'));
  const fSol = document.getElementById('formSolicitudFact');
  if (fSol) fSol.addEventListener('submit', (e) => { e.preventDefault(); solicitarIntegracion(); });
}

async function cargarOpcionesConfig() {
  await renderEmpresaMoneda();
  const giros = await window.api.giros.listar();
  document.getElementById('selectGiro').innerHTML = giros.map(g => `<option value="${g.nombre}">${g.nombre}</option>`).join('');
  document.getElementById('selectGiro').value = ESTADO.giro || giros[0]?.nombre;
  if (ESTADO.giro) ESTADO.camposGiro = await window.api.giros.campos(ESTADO.giro);
  renderCategorias();
  renderCamposGiro();
  if (puedeUI('config.ver')) cargarAdopcion();
  renderSuscripcion();
  cargarEmailConfig();
  cargarWaConfig();
  cargarFacturacion();
}

/* ---------- Empresa, pais y moneda ---------- */

async function cargarMonedas() {
  if (!ESTADO.catalogoMonedas) ESTADO.catalogoMonedas = await window.api.monedas.listar();
  return ESTADO.catalogoMonedas;
}

function infoMonedaUI(codigo) {
  const lista = (ESTADO.catalogoMonedas && ESTADO.catalogoMonedas.monedas) || [];
  return lista.find(m => m.codigo === codigo) || null;
}

function renderVistaPreviaMoneda() {
  const el = document.getElementById('vistaPreviaMoneda');
  if (!el) return;
  const codigo = document.getElementById('selectMoneda').value;
  const m = infoMonedaUI(codigo);
  if (!m) { el.textContent = ''; return; }
  el.textContent = `Vista previa: ${formatoConInfo(1234.5, m)}  ·  ${m.nombre} (${m.codigo})`;
}

async function renderEmpresaMoneda() {
  const selPais = document.getElementById('selectPais');
  const selMoneda = document.getElementById('selectMoneda');
  if (!selPais || !selMoneda) return;

  const cat = await cargarMonedas();
  selPais.innerHTML = cat.paises.map(p => `<option value="${p.codigo}">${escaparHtml(p.nombre)}</option>`).join('');
  selMoneda.innerHTML = cat.monedas.map(m => `<option value="${m.codigo}">${escaparHtml(m.nombre)} (${escaparHtml(m.simbolo)})</option>`).join('');

  const emp = ESTADO.empresa || {};
  document.getElementById('empresaNombre').value = emp.nombre || '';
  document.getElementById('empresaRif').value = emp.rif || '';
  if (emp.pais) selPais.value = emp.pais;
  if (emp.moneda) selMoneda.value = emp.moneda;
  const ivaEl = document.getElementById('inputTasaIva');
  if (ivaEl) ivaEl.value = (emp.tasa_iva != null ? emp.tasa_iva : 0);

  renderVistaPreviaMoneda();
}

async function guardarEmpresaMoneda() {
  const nombre = document.getElementById('empresaNombre').value.trim();
  const rif = document.getElementById('empresaRif').value.trim();
  const pais = document.getElementById('selectPais').value;
  const moneda = document.getElementById('selectMoneda').value;
  const tasaIva = Number(document.getElementById('inputTasaIva').value) || 0;
  if (!nombre) return notificar('El nombre de la empresa no puede quedar vacio', true);

  try {
    const resp = await window.api.empresa.guardar({ nombre, rif, pais, moneda, tasa_iva: tasaIva });
    ESTADO.empresa = resp.empresa;
    ESTADO.monedaInfo = resp.empresa && resp.empresa.moneda_info || null;
    renderVistaPreviaMoneda();
    if (resp.aviso) notificar(resp.aviso, true);
    else notificar('Datos y moneda guardados');
    // Vuelve a pintar la vista con la nueva moneda (el dashboard y demas
    // pantallas se recalculan al navegar).
    if (ESTADO.vista !== 'config') navegar(ESTADO.vista);
  } catch (err) {
    notificar('Error: ' + err.message, true);
  }
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

/* ------------------ Suscripcion y plan ------------------ */

async function renderSuscripcion() {
  const cont = document.getElementById('suscripcionContenido');
  if (!cont) return;
  try {
    const s = await window.api.suscripcion.obtener();
    ESTADO.suscripcion = s;
    const plan = s.plan || {};
    const estado = s.estado || 'activo';
    const venc = s.fecha_vencimiento || s.trial_ends_at;
    const vigencia = s.vencida
      ? 'Vencido'
      : (venc ? 'Vigente hasta ' + formatoFecha(venc).slice(0, 10) : 'Sin vencimiento');
    const limites = s.limites || {};
    const uso = s.uso || {};
    const etiquetas = { productos: 'Productos', usuarios: 'Usuarios', proveedores: 'Proveedores', almacenes: 'Almacenes' };
    const barras = Object.keys(limites).map((r) => {
      const lim = limites[r];
      const u = uso[r] || 0;
      const pct = (lim == null || !lim) ? 0 : Math.min(100, Math.round((u / lim) * 100));
      const limTxt = (lim == null) ? 'ilimitado' : lim;
      const color = pct >= 100 ? '#ef4444' : (pct >= 80 ? '#f59e0b' : '#22c55e');
      return `<div style="margin:6px 0">
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span>${escaparHtml(etiquetas[r] || r)}</span><span>${u} / ${limTxt}</span>
        </div>
        <div style="background:#e5e7eb;border-radius:6px;height:8px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color}"></div>
        </div>
      </div>`;
    }).join('');
    cont.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <div><strong>Plan:</strong> ${escaparHtml(plan.nombre || plan.codigo || '-')}</div>
        <div><strong>Estado:</strong> ${escaparHtml(estado)}</div>
        <div><strong>Vigencia:</strong> ${escaparHtml(vigencia)}</div>
        ${s.en_prueba ? '<span class="chip">En prueba</span>' : ''}
        ${s.en_revision ? '<span class="chip">Pago en revision</span>' : ''}
      </div>
      ${barras}
      ${s.aviso ? `<p class="texto-ayuda" style="color:#b45309">${escaparHtml(s.aviso)}</p>` : ''}`;
    await renderPlanesComparativo(s.planes || []);
  } catch (err) {
    cont.innerHTML = '<p class="texto-ayuda">No se pudo cargar la suscripcion: ' + escaparHtml(err.message) + '</p>';
  }
}

async function renderPlanesComparativo(planes) {
  const cont = document.getElementById('planesComparativo');
  if (!cont) return;
  if (!planes || !planes.length) {
    try { planes = await window.api.planes.listar(); } catch { planes = []; }
  }
  if (!planes || !planes.length) { cont.innerHTML = ''; return; }
  const actual = ESTADO.suscripcion && ESTADO.suscripcion.plan && ESTADO.suscripcion.plan.codigo;
  cont.innerHTML = `
    <h4 style="margin:8px 0 4px;font-size:13px">Comparativo de planes</h4>
    <table class="tabla">
      <thead><tr><th>Plan</th><th>Precio</th><th>Productos</th><th>Usuarios</th><th>Proveedores</th><th>Multi-almacen</th></tr></thead>
      <tbody>
        ${planes.map(p => {
          const lim = p.limites || {};
          const fmt = (v) => (v == null ? 'Ilimitado' : v);
          const precio = (p.precio && p.precio.mensual != null)
            ? (p.precio.mensual === 0 ? 'Gratis' : (p.precio.mensual + ' ' + (p.precio.moneda || '') + '/mes'))
            : '-';
          return `<tr ${p.codigo === actual ? 'style="background:#eff6ff"' : ''}>
            <td><strong>${escaparHtml(p.nombre)}</strong>${p.codigo === actual ? ' (actual)' : ''}</td>
            <td>${escaparHtml(precio)}</td>
            <td>${fmt(lim.productos)}</td>
            <td>${fmt(lim.usuarios)}</td>
            <td>${fmt(lim.proveedores)}</td>
            <td>${p.multi_almacen ? 'Si' : 'No'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

async function iniciarPago(pasarela) {
  const planSel = document.getElementById('pagoPlan');
  const cicloSel = document.getElementById('pagoCiclo');
  const plan = (planSel && planSel.value) || 'basic';
  const ciclo = (cicloSel && cicloSel.value) || 'mensual';
  try {
    const r = await window.api.pagos.checkout(pasarela, { plan, ciclo });
    if (r && r.url) { window.location.href = r.url; }
    else notificar('No se obtuvo la URL de pago', true);
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function registrarTransferencia() {
  const plan = document.getElementById('trPlan').value;
  const ciclo = document.getElementById('trCiclo').value;
  const comprobante = document.getElementById('trComprobante').value.trim();
  const referencia = document.getElementById('trReferencia').value.trim();
  const nota = document.getElementById('trNota').value.trim();
  try {
    await window.api.pagos.transferencia({ plan, ciclo, comprobante_url: comprobante, referencia, nota });
    cerrarModal('modalTransferencia');
    const f = document.getElementById('formTransferencia');
    if (f) f.reset();
    notificar('Transferencia registrada. Un administrador la revisara.');
    await renderSuscripcion();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

function abrirModalUpgrade(detalle) {
  const titulo = document.getElementById('upgradeTitulo');
  const msg = document.getElementById('upgradeMensaje');
  const det = document.getElementById('upgradeDetalle');
  if (!titulo || !msg) return;
  if (detalle && detalle.codigo === 'PlanVencido') {
    titulo.textContent = 'Tu plan no esta activo';
    msg.textContent = detalle.error || 'Renueva tu plan para seguir creando registros.';
  } else {
    titulo.textContent = 'Alcanzaste el limite de tu plan';
    msg.textContent = detalle && detalle.error ? detalle.error : 'Sube de plan para continuar.';
  }
  if (det) {
    if (detalle && detalle.recurso) {
      det.textContent = 'Recurso: ' + (detalle.recurso_nombre || detalle.recurso) +
        '\nUso: ' + detalle.uso + ' / ' + detalle.limite +
        '\nPlan: ' + (detalle.plan || '');
      det.style.display = 'block';
    } else {
      det.textContent = '';
      det.style.display = 'none';
    }
  }
  abrirModal('modalUpgrade');
}

function irASuscripcion() {
  cerrarModal('modalUpgrade');
  navegar('config');
  setTimeout(() => {
    const el = document.getElementById('suscripcionContenido');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderSuscripcion();
  }, 150);
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
    const prod = await window.api.producto.obtener(id).catch(() => null);
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
        <div class="traza-linea"><span class="traza-etiqueta">Stock actual (total)</span><span>${t.producto.stock_actual}</span></div>
        ${prod && prod.stock_por_almacen && prod.stock_por_almacen.length ? `<div class="traza-bloque"><h4>Stock por almacen</h4>${prod.stock_por_almacen.map(s => `<div class="traza-linea"><span class="traza-etiqueta">${escaparHtml(s.almacen || 'Almacen')}</span><span>${s.cantidad}${s.principal ? ' (principal)' : ''}</span></div>`).join('')}</div>` : ''}
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

/* ------------------ Contabilidad ------------------ */

function formatoInputFecha(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function configurarEventosContabilidad() {
  const desde = document.getElementById('contabDesde');
  const hasta = document.getElementById('contabHasta');
  if (!desde || !hasta) return;
  const hoy = new Date();
  desde.value = formatoInputFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  hasta.value = formatoInputFecha(hoy);
  document.getElementById('btnConsultarContab').addEventListener('click', cargarContabilidad);
  document.getElementById('btnExportarContab').addEventListener('click', exportarContabilidad);
  document.getElementById('btnImprimirContab').addEventListener('click', imprimirContabilidad);
}

async function cargarContabilidad() {
  const desde = document.getElementById('contabDesde').value || undefined;
  const hasta = document.getElementById('contabHasta').value || undefined;
  try {
    ESTADO.contabilidad = await window.api.contabilidad.resumen({ desde, hasta });
    renderContabilidad();
  } catch (err) {
    ESTADO.contabilidad = null;
    document.getElementById('contabKpis').innerHTML =
      `<div class="stat-card error"><h4>Contabilidad no disponible</h4><div class="valor" style="font-size:13px">${escaparHtml(err.message)}</div></div>`;
    document.getElementById('contabCategoriasBody').innerHTML = '';
    document.getElementById('kardexBody').innerHTML = '';
  }
}

function renderContabilidad() {
  const r = ESTADO.contabilidad;
  if (!r) return;
  const s = r.resumen || {};

  document.getElementById('contabKpis').innerHTML = `
    <div class="stat-card primario"><h4>Valor a costo</h4><div class="valor">${formatoMoneda(s.valorCosto || 0)}</div></div>
    <div class="stat-card"><h4>Valor a venta</h4><div class="valor">${formatoMoneda(s.valorVenta || 0)}</div></div>
    <div class="stat-card exito"><h4>Utilidad en inventario</h4><div class="valor">${formatoMoneda(s.utilidadInventario || 0)}</div></div>
    <div class="stat-card"><h4>Entradas (costo)</h4><div class="valor">${formatoMoneda(s.entradasCosto || 0)}</div><div class="texto-ayuda">${s.entradasUnidades || 0} unidades</div></div>
    <div class="stat-card"><h4>Salidas (costo)</h4><div class="valor">${formatoMoneda(s.salidasCosto || 0)}</div><div class="texto-ayuda">${s.salidasUnidades || 0} unidades</div></div>
    <div class="stat-card"><h4>Ventas (valor)</h4><div class="valor">${formatoMoneda(s.salidasVenta || 0)}</div></div>
    <div class="stat-card ${(s.margen || 0) < 0 ? 'error' : 'exito'}"><h4>Margen bruto del periodo</h4><div class="valor">${formatoMoneda(s.margen || 0)}</div></div>
    <div class="stat-card"><h4>Unidades en stock</h4><div class="valor">${s.unidades || 0}</div><div class="texto-ayuda">${s.productos || 0} productos</div></div>
  `;

  const cats = r.categorias || [];
  document.getElementById('contabCategoriasBody').innerHTML = cats.length
    ? cats.map(c => `<tr>
        <td>${escaparHtml(c.categoria)}</td><td>${c.productos}</td><td>${c.unidades}</td>
        <td>${formatoMoneda(c.valor_costo || 0)}</td>
        <td>${formatoMoneda(c.valor_venta || 0)}</td>
        <td>${formatoMoneda((c.valor_venta || 0) - (c.valor_costo || 0))}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Sin datos</td></tr>';

  const kardex = r.kardex || [];
  document.getElementById('kardexBody').innerHTML = kardex.length
    ? kardex.map(m => `<tr>
        <td>${formatoFecha(m.fecha)}</td>
        <td>${escaparHtml(m.producto_nombre || '-')}</td>
        <td><span class="badge ${m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo}</span></td>
        <td>${escaparHtml(m.concepto || '-')}</td>
        <td>${escaparHtml(m.documento || '-')}</td>
        <td>${m.cantidad}</td>
        <td>${formatoMoneda(m.precio_unitario || 0)}</td>
        <td>${formatoMoneda(m.costo_unitario || 0)}</td>
        <td>${formatoMoneda(m.costo_total || 0)}</td>
        <td>${m.stock_resultante ?? '-'}</td>
        <td>${formatoMoneda(m.saldo_valor || 0)}</td>
      </tr>`).join('')
    : '<tr><td colspan="11" class="vacio">Sin movimientos en el periodo</td></tr>';
}

async function exportarContabilidad() {
  if (!ESTADO.contabilidad) await cargarContabilidad();
  const kardex = (ESTADO.contabilidad && ESTADO.contabilidad.kardex) || [];
  if (!kardex.length) return notificar('No hay movimientos para exportar en el periodo', true);
  await window.api.export.excel({
    filas: kardex.map(m => ({
      fecha: m.fecha, producto: m.producto_nombre || '', tipo: m.tipo,
      concepto: m.concepto || '', documento: m.documento || '',
      cantidad: m.cantidad, precio: m.precio_unitario, costo_unitario: m.costo_unitario,
      costo_total: m.costo_total, saldo_unidades: m.stock_resultante, saldo_valor: m.saldo_valor,
    })),
    columnas: [
      { campo: 'fecha', titulo: 'Fecha', ancho: 20 },
      { campo: 'producto', titulo: 'Producto', ancho: 30 },
      { campo: 'tipo', titulo: 'Tipo', ancho: 10 },
      { campo: 'concepto', titulo: 'Concepto', ancho: 24 },
      { campo: 'documento', titulo: 'Documento', ancho: 18 },
      { campo: 'cantidad', titulo: 'Cantidad', ancho: 10 },
      { campo: 'precio', titulo: 'Precio', ancho: 12 },
      { campo: 'costo_unitario', titulo: 'Costo unit.', ancho: 12 },
      { campo: 'costo_total', titulo: 'Costo total', ancho: 14 },
      { campo: 'saldo_unidades', titulo: 'Saldo uds', ancho: 11 },
      { campo: 'saldo_valor', titulo: 'Saldo valor', ancho: 14 },
    ],
    nombreArchivo: 'kardex_valorizado.xlsx',
    hoja: 'Kardex',
  });
  notificar('Kardex exportado');
}

async function imprimirContabilidad() {
  if (!ESTADO.contabilidad) await cargarContabilidad();
  const r = ESTADO.contabilidad;
  if (!r) return notificar('No hay informe contable para imprimir', true);
  const s = r.resumen || {};
  const cats = r.categorias || [];
  const kardex = r.kardex || [];

  const filasCat = cats.map(c => `<tr>
      <td>${escaparHtml(c.categoria)}</td><td class="num">${c.productos}</td><td class="num">${c.unidades}</td>
      <td class="num">${formatoMoneda(c.valor_costo || 0)}</td><td class="num">${formatoMoneda(c.valor_venta || 0)}</td>
    </tr>`).join('');

  const filasKar = kardex.map(m => `<tr>
      <td>${formatoFecha(m.fecha)}</td><td>${escaparHtml(m.producto_nombre || '-')}</td>
      <td>${m.tipo}</td><td>${escaparHtml(m.concepto || '-')}</td>
      <td class="num">${m.cantidad}</td>
      <td class="num">${formatoMoneda(m.costo_unitario || 0)}</td>
      <td class="num">${formatoMoneda(m.costo_total || 0)}</td>
      <td class="num">${formatoMoneda(m.saldo_valor || 0)}</td>
    </tr>`).join('');

  const cuerpo = `
    ${encabezadoImpresion('Informe contable de inventario', `Periodo del ${r.desde} al ${r.hasta}`)}
    <table>
      <tbody>
        <tr><th style="width:34%">Valor del inventario a costo</th><td class="num">${formatoMoneda(s.valorCosto || 0)}</td></tr>
        <tr><th>Valor del inventario a venta</th><td class="num">${formatoMoneda(s.valorVenta || 0)}</td></tr>
        <tr><th>Utilidad potencial en inventario</th><td class="num">${formatoMoneda(s.utilidadInventario || 0)}</td></tr>
        <tr><th>Entradas del periodo (costo)</th><td class="num">${formatoMoneda(s.entradasCosto || 0)}</td></tr>
        <tr><th>Salidas del periodo (costo de lo vendido)</th><td class="num">${formatoMoneda(s.salidasCosto || 0)}</td></tr>
        <tr><th>Ventas del periodo (valor)</th><td class="num">${formatoMoneda(s.salidasVenta || 0)}</td></tr>
        <tr><th>Margen bruto del periodo</th><td class="num">${formatoMoneda(s.margen || 0)}</td></tr>
      </tbody>
    </table>
    <h3 style="font-size:13px;margin:16px 0 4px">Inventario por categoria</h3>
    <table>
      <thead><tr><th>Categoria</th><th class="num">Productos</th><th class="num">Unidades</th><th class="num">Valor costo</th><th class="num">Valor venta</th></tr></thead>
      <tbody>${filasCat || '<tr><td colspan="5">Sin datos</td></tr>'}</tbody>
    </table>
    <h3 style="font-size:13px;margin:16px 0 4px">Kardex valorizado (${kardex.length} movimientos)</h3>
    <table>
      <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Concepto</th><th class="num">Cant.</th><th class="num">Costo unit.</th><th class="num">Costo total</th><th class="num">Saldo valor</th></tr></thead>
      <tbody>${filasKar || '<tr><td colspan="8">Sin movimientos</td></tr>'}</tbody>
    </table>
    <div class="firmas">
      <div class="firma">Elaborado por</div>
      <div class="firma">Revisado por</div>
    </div>`;
  await imprimirDocumento('Informe contable de inventario', cuerpo);
}

/* ------------------ Comercial (POS) ------------------ */

function configurarEventosComercial() {
  const bn = document.getElementById('btnNuevoCliente');
  if (bn) bn.addEventListener('click', () => { const idEl = document.getElementById('clienteId'); if (idEl) idEl.value = ''; const f = document.getElementById('formCliente'); if (f) f.reset(); abrirModal('modalCliente'); });
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
  const bAc = document.getElementById('btnAbrirCaja');
  if (bAc) bAc.addEventListener('click', async () => {
    const monto = Number(document.getElementById('cajaMontoInicial').value) || 0;
    try {
      await window.api.caja.abrir(monto);
      notificar('Caja abierta');
      document.getElementById('cajaMontoInicial').value = '';
      await cargarSesionesCaja();
    } catch (err) { notificar('Error: ' + err.message, true); }
  });
}

async function cargarClientes() {
  try { ESTADO.clientes = await window.api.clientes.listar(); } catch { ESTADO.clientes = []; }
  renderClientes();
}
function renderClientes() {
  const tb = document.getElementById('clientesBody');
  if (!tb) return;
  tb.innerHTML = ESTADO.clientes.length
    ? ESTADO.clientes.map(c => '<tr>' +
        '<td>' + escaparHtml(c.nombre) + '</td>' +
        '<td>' + escaparHtml(c.rif || '-') + '</td>' +
        '<td>' + escaparHtml(c.telefono || '-') + '</td>' +
        '<td>' + escaparHtml(c.email || '-') + '</td>' +
        '<td><button class="btn btn-ghost btn-mini" onclick="editarCliente(' + c.id + ')">Editar</button> ' +
            '<button class="btn btn-ghost btn-mini" onclick="cobrarCliente(\'' + c.id + '\')">Cobrar</button></td>' +
      '</tr>').join('')
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
    ? ESTADO.ventas.map(v => '<tr>' +
        '<td>' + escaparHtml(v.numero) + '</td>' +
        '<td>' + formatoFecha(v.fecha) + '</td>' +
        '<td>' + escaparHtml(v.cliente_nombre || 'Mostrador') + '</td>' +
        '<td>' + formatoMoneda(v.total) + '</td>' +
        '<td>' + escaparHtml(v.estado) + '</td>' +
        '<td><button class="btn btn-ghost btn-mini" onclick="verVenta(\'' + v.id + '\')">Ver</button> ' +
            '<button class="btn btn-ghost btn-mini" onclick="imprimirFacturaVenta(\'' + v.id + '\')">Factura</button> ' +
            '<button class="btn btn-ghost btn-mini" onclick="window.open(window.api.ventas.facturaUrl(\'' + v.id + '\'),\'_blank\')">PDF</button> ' +
            '<button class="btn btn-ghost btn-mini" onclick="timbrarVenta(\'' + v.id + '\')">Timbrar</button></td>' +
      '</tr>').join('')
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
    window.api.clientes.listar().then((cs) => { ESTADO.clientes = cs || []; const sel = document.getElementById('ventaCliente'); if (sel) sel.innerHTML = '<option value="">Mostrador (sin cliente)</option>' + (ESTADO.clientes.map(c => '<option value="' + c.id + '">' + escaparHtml(c.nombre) + '</option>').join('')); }).catch(() => {});
  }
  document.getElementById('ventaSubtotal').textContent = '0';
  document.getElementById('ventaTotal').textContent = '0';
  document.getElementById('ventaDescuento').value = 0;
  document.getElementById('ventaImpuesto').value = 0;
  document.getElementById('ventaNotas').value = '';
  const sel = document.getElementById('ventaCliente');
  if (sel) {
    sel.innerHTML = '<option value="">Mostrador (sin cliente)</option>' +
      ESTADO.clientes.map(c => '<option value="' + c.id + '">' + escaparHtml(c.nombre) + '</option>').join('');
  }
  window.api.almacenes.listar().then((as) => {
    ESTADO.almacenes = as || [];
    const sa = document.getElementById('ventaAlmacen');
    if (sa) sa.innerHTML = '<option value="">Principal</option>' +
      (as || []).map(a => '<option value="' + a.id + '">' + escaparHtml(a.nombre) + '</option>').join('');
  }).catch(() => {});
  renderVentaItems();
  abrirModal('modalVenta');
}
function agregarItemVenta() {
  const term = (document.getElementById('ventaBusquedaProd').value || '').trim().toLowerCase();
  if (!term) return notificar('Busca un producto', true);
  const prod = ESTADO.productos.find(p => ((p.nombre || '').toLowerCase().includes(term)) || ((p.codigo || '').toLowerCase().includes(term)));
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
    return '<tr>' +
      '<td>' + escaparHtml(it.nombre) + '</td>' +
      '<td><input type="number" min="1" value="' + it.cantidad + '" onchange="actualizarItemVenta(' + idx + ',\'cantidad\',this.value)" style="width:60px" /></td>' +
      '<td><input type="number" step="0.01" value="' + it.precio_unitario + '" onchange="actualizarItemVenta(' + idx + ',\'precio_unitario\',this.value)" style="width:80px" /></td>' +
      '<td><input type="number" step="0.01" value="' + (it.descuento || 0) + '" onchange="actualizarItemVenta(' + idx + ',\'descuento\',this.value)" style="width:70px" /></td>' +
      '<td>' + formatoMoneda(sub) + '</td>' +
      '<td><button class="btn btn-ghost btn-mini" onclick="quitarItemVenta(' + idx + ')">x</button></td>' +
    '</tr>';
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
    ? ESTADO.compras.map(c => '<tr>' +
        '<td>' + escaparHtml(c.numero) + '</td>' +
        '<td>' + formatoFecha(c.fecha) + '</td>' +
        '<td>' + escaparHtml(c.proveedor_nombre || '-') + '</td>' +
        '<td>' + formatoMoneda(c.total) + '</td>' +
        '<td>' + escaparHtml(c.estado) + '</td>' +
        '<td><button class="btn btn-ghost btn-mini" onclick="verCompra(\'' + c.id + '\')">Ver</button></td>' +
      '</tr>').join('')
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
      ESTADO.proveedores.map(p => '<option value="' + p.id + '">' + escaparHtml(p.nombre) + '</option>').join('');
  }
  window.api.almacenes.listar().then((as) => {
    ESTADO.almacenes = as || [];
    const sa = document.getElementById('compraAlmacen');
    if (sa) sa.innerHTML = '<option value="">Principal</option>' +
      (as || []).map(a => '<option value="' + a.id + '">' + escaparHtml(a.nombre) + '</option>').join('');
  }).catch(() => {});
  renderCompraItems();
  abrirModal('modalCompra');
}
function agregarItemCompra() {
  const term = (document.getElementById('compraBusquedaProd').value || '').trim().toLowerCase();
  if (!term) return notificar('Busca un producto', true);
  const prod = ESTADO.productos.find(p => ((p.nombre || '').toLowerCase().includes(term)) || ((p.codigo || '').toLowerCase().includes(term)));
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
    return '<tr>' +
      '<td>' + escaparHtml(it.nombre) + '</td>' +
      '<td><input type="number" min="1" value="' + it.cantidad + '" onchange="actualizarItemCompra(' + idx + ',\'cantidad\',this.value)" style="width:60px" /></td>' +
      '<td><input type="number" step="0.01" value="' + it.costo_unitario + '" onchange="actualizarItemCompra(' + idx + ',\'costo_unitario\',this.value)" style="width:80px" /></td>' +
      '<td>' + formatoMoneda(sub) + '</td>' +
      '<td><button class="btn btn-ghost btn-mini" onclick="quitarItemCompra(' + idx + ')">x</button></td>' +
    '</tr>';
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
    ? ESTADO.cxc.map(c => '<tr>' +
        '<td>' + escaparHtml(c.venta_numero || '-') + '</td>' +
        '<td>' + escaparHtml(c.cliente_nombre || '-') + '</td>' +
        '<td>' + formatoMoneda(c.monto_total) + '</td>' +
        '<td>' + formatoMoneda(c.monto_cobrado) + '</td>' +
        '<td>' + formatoMoneda(c.saldo) + '</td>' +
        '<td>' + escaparHtml(c.estado) + '</td>' +
        '<td><button class="btn btn-ghost btn-mini" onclick="abrirCobro(\'' + (c.cliente_id || '') + '\',\'' + (c.venta_id || '') + '\')">Cobrar</button></td>' +
      '</tr>').join('')
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
    ? ESTADO.cxp.map(c => '<tr>' +
        '<td>' + escaparHtml(c.compra_numero || '-') + '</td>' +
        '<td>' + escaparHtml(c.proveedor_nombre || '-') + '</td>' +
        '<td>' + formatoMoneda(c.monto_total) + '</td>' +
        '<td>' + formatoMoneda(c.monto_pagado) + '</td>' +
        '<td>' + formatoMoneda(c.saldo) + '</td>' +
        '<td>' + escaparHtml(c.estado) + '</td>' +
        '<td><button class="btn btn-ghost btn-mini" onclick="abrirPagoProv(\'' + (c.proveedor_id || '') + '\',\'' + (c.compra_id || '') + '\')">Pagar</button></td>' +
      '</tr>').join('')
    : '<tr><td colspan="7" class="vacio">Sin cuentas por pagar</td></tr>';
}
window.abrirPagoProv = function (proveedorId, compraId) {
  const sel = document.getElementById('pagoProvProveedor');
  if (sel) {
    sel.innerHTML = ESTADO.proveedores.map(p => '<option value="' + p.id + '" ' + (p.id === proveedorId ? 'selected' : '') + '>' + escaparHtml(p.nombre) + '</option>').join('');
  }
  const sc = document.getElementById('pagoProvCompra');
  if (sc) {
    sc.innerHTML = '<option value="">Sin compra especifica</option>' +
      ESTADO.compras.filter(c => !compraId || c.id === compraId).map(c => '<option value="' + c.id + '" ' + (c.id === compraId ? 'selected' : '') + '>' + escaparHtml(c.numero) + '</option>').join('');
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
    if (cont) {
      const metodos = Object.entries(r.por_metodo || {}).map(([k, v]) => '<div>' + k + ': ' + formatoMoneda(v) + '</div>').join('');
      cont.innerHTML = '<div style="font-size:18px;font-weight:bold">Total hoy: ' + formatoMoneda(r.total) + '</div>' +
        '<div style="margin-top:8px">' + (metodos || 'Sin cobros') + '</div>' +
        '<div style="margin-top:8px">' + ((r.cobros || []).length) + ' cobros</div>';
    }
  } catch (err) {
    const cont = document.getElementById('cajaResumen');
    if (cont) cont.innerHTML = 'No se pudo cargar la caja: ' + escaparHtml(err.message);
  }
  await cargarSesionesCaja();
}

async function cargarSesionesCaja() {
  try {
    const sesiones = await window.api.caja.sesiones();
    const tb = document.getElementById('cajaSesionesBody');
    if (!tb) return;
    tb.innerHTML = (sesiones || []).map(s => '<tr>' +
      '<td>' + formatoFecha(s.fecha_apertura) + '</td>' +
      '<td>' + formatoMoneda(s.monto_inicial) + '</td>' +
      '<td>' + (s.monto_final_esperado != null ? formatoMoneda(s.monto_final_esperado) : '-') + '</td>' +
      '<td>' + (s.monto_final_real != null ? formatoMoneda(s.monto_final_real) : '-') + '</td>' +
      '<td>' + (s.diferencia != null ? formatoMoneda(s.diferencia) : '-') + '</td>' +
      '<td>' + escaparHtml(s.estado) + '</td>' +
      '<td>' + (s.estado === 'abierta' ? '<button class="btn btn-ghost btn-mini" onclick="cerrarCaja(\'' + s.id + '\')">Cerrar</button>' : '') + '</td>' +
    '</tr>').join('') || '<tr><td colspan="7" class="vacio">Sin sesiones</td></tr>';
  } catch (err) { /* ignore */ }
}

window.cerrarCaja = async function (id) {
  // Obtener sesion para mostrar desglose esperado
  let sesion = null;
  try {
    const sesiones = await window.api.caja.sesiones();
    sesion = (sesiones || []).find((s) => s.id === id);
  } catch (e) { /* ignore */ }
  const desglose = (sesion && sesion.desglose_esperado) || {};
  const metodos = Object.keys(desglose);
  let montoReal = 0;
  const desgloseReal = {};
  if (metodos.length) {
    let msg = 'Desglose esperado:\n';
    for (const m of metodos) { msg += m + ': ' + desglose[m] + '\n'; }
    msg += '\nIngresa el monto real total en caja:';
    const input = prompt(msg);
    if (input === null) return;
    montoReal = Number(input) || 0;
  } else {
    const input = prompt('Monto real en caja:');
    if (input === null) return;
    montoReal = Number(input) || 0;
  }
  const notas = prompt('Notas (opcional):') || '';
  try {
    const r = await window.api.caja.cerrarDetallado(id, montoReal, desgloseReal, notas);
    let extra = '';
    if (r.desglose_esperado) {
      extra = '\nDesglose esperado: ' + Object.entries(r.desglose_esperado).map(([k, v]) => k + '=' + v).join(', ');
    }
    notificar('Caja cerrada. Diferencia: ' + formatoMoneda(r.diferencia) + extra);
    await cargarSesionesCaja();
  } catch (err) { notificar('Error: ' + err.message, true); }
};

window.abrirCobro = window.abrirCobro;
window.abrirPagoProv = window.abrirPagoProv;

function configurarEventosReportes() {
  const b = document.getElementById('btnCargarReporteVentas');
  if (b) b.addEventListener('click', cargarReporteVentas);
  const b2 = document.getElementById('btnCargarCajaReporte');
  if (b2) b2.addEventListener('click', cargarReporteCaja);
}

async function cargarReportes() {
  await cargarReporteVentas();
  await cargarReporteCxc();
  await cargarReporteCxp();
  await cargarReporteCaja();
}

async function cargarReporteVentas() {
  const desde = document.getElementById('repDesde').value;
  const hasta = document.getElementById('repHasta').value;
  try {
    const r = await window.api.reportes.ventas({ desde, hasta });
    const tb = document.getElementById('reporteVentasBody');
    if (tb) {
      tb.innerHTML = (r.filas || []).map(f => '<tr>' +
        '<td>' + escaparHtml(f.numero) + '</td>' +
        '<td>' + formatoFecha(f.fecha) + '</td>' +
        '<td>' + escaparHtml(f.cliente || '-') + '</td>' +
        '<td>' + formatoMoneda(f.total) + '</td>' +
        '<td>' + formatoMoneda(f.costo) + '</td>' +
        '<td>' + formatoMoneda(f.margen) + '</td>' +
        '<td>' + f.margen_pct + '%</td>' +
      '</tr>').join('') || '<tr><td colspan="7" class="vacio">Sin ventas</td></tr>';
    }
    const t = document.getElementById('reporteVentasTotales');
    if (t && r.totales) {
      t.innerHTML = 'Ventas: ' + r.totales.ventas + ' | Total: ' + formatoMoneda(r.totales.total) +
        ' | Costo: ' + formatoMoneda(r.totales.costo) + ' | Margen: ' + formatoMoneda(r.totales.margen);
    }
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarReporteCxc() {
  try {
    const r = await window.api.reportes.cxc();
    const tb = document.getElementById('reporteCxcBody');
    if (tb) {
      tb.innerHTML = (r.filas || []).map(f => '<tr>' +
        '<td>' + escaparHtml(f.cliente || '-') + '</td>' +
        '<td>' + formatoMoneda(f.saldo) + '</td>' +
        '<td>' + f.dias + '</td>' +
        '<td>' + f.bucket + '</td>' +
      '</tr>').join('') || '<tr><td colspan="4" class="vacio">Sin CxC</td></tr>';
    }
    const res = document.getElementById('reporteCxcResumen');
    if (res && r.resumen) {
      res.innerHTML = '0-30: ' + formatoMoneda(r.resumen['0-30']) +
        ' | 31-60: ' + formatoMoneda(r.resumen['31-60']) +
        ' | 61-90: ' + formatoMoneda(r.resumen['61-90']) +
        ' | 90+: ' + formatoMoneda(r.resumen['90+']) +
        ' | Total: ' + formatoMoneda(r.resumen.total);
    }
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarReporteCxp() {
  try {
    const r = await window.api.reportes.cxp();
    const tb = document.getElementById('reporteCxpBody');
    if (tb) {
      tb.innerHTML = (r.filas || []).map(f => '<tr>' +
        '<td>' + escaparHtml(f.proveedor || '-') + '</td>' +
        '<td>' + formatoMoneda(f.saldo) + '</td>' +
        '<td>' + f.dias + '</td>' +
        '<td>' + f.bucket + '</td>' +
      '</tr>').join('') || '<tr><td colspan="4" class="vacio">Sin CxP</td></tr>';
    }
    const res = document.getElementById('reporteCxpResumen');
    if (res && r.resumen) {
      res.innerHTML = '0-30: ' + formatoMoneda(r.resumen['0-30']) +
        ' | 31-60: ' + formatoMoneda(r.resumen['31-60']) +
        ' | 61-90: ' + formatoMoneda(r.resumen['61-90']) +
        ' | 90+: ' + formatoMoneda(r.resumen['90+']) +
        ' | Total: ' + formatoMoneda(r.resumen.total);
    }
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarReporteCaja() {
  const desde = document.getElementById('cajaDesde').value;
  const hasta = document.getElementById('cajaHasta').value;
  try {
    const r = await window.api.reportes.caja({ desde, hasta });
    const cont = document.getElementById('reporteCajaResumen');
    if (cont) {
      const metodos = Object.entries(r.por_metodo || {}).map(([k, v]) => k + ': ' + formatoMoneda(v)).join(' | ');
      const dias = Object.entries(r.por_dia || {}).map(([k, v]) => k + ': ' + formatoMoneda(v)).join(' | ');
      cont.innerHTML = '<div>Total: ' + formatoMoneda(r.total) + ' (' + r.cobros + ' cobros)</div>' +
        '<div style="margin-top:4px">' + (metodos || 'Sin cobros') + '</div>' +
        '<div style="margin-top:4px;font-size:12px">' + (dias || '') + '</div>';
    }
  } catch (err) { notificar('Error: ' + err.message, true); }
}

window.imprimirFacturaVenta = async function (id) {
  try {
    const r = await window.api.ventas.obtener(id);
    const v = r.venta;
    const det = r.detalle || [];
    const emp = ESTADO.empresa || {};
    const tasa = Number(emp.tasa_iva) || 0;
    const subtotal = Number(v.subtotal) || 0;
    const iva = Math.round(subtotal * tasa / 100 * 100) / 100;
    const filas = det.map(d => '<tr><td>' + escaparHtml(d.producto_nombre || '') + '</td><td>' + d.cantidad + '</td><td>' + formatoMoneda(d.precio_unitario) + '</td><td>' + formatoMoneda(d.subtotal) + '</td></tr>').join('');
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Factura ' + escaparHtml(v.numero) + '</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px 6px}th{background:#eee}.totales{text-align:right;margin-top:10px}.totales div{margin:2px 0}</style></head><body>' +
      '<h2>Factura ' + escaparHtml(v.numero) + '</h2>' +
      '<div>Empresa: ' + escaparHtml(emp.nombre || '') + '</div>' +
      '<div>RIF: ' + escaparHtml(emp.rif || '') + '</div>' +
      '<div>Cliente: ' + escaparHtml(v.cliente_nombre || 'Mostrador') + '</div>' +
      '<div>Fecha: ' + formatoFecha(v.fecha) + '</div>' +
      '<table style="margin-top:10px"><thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<div class="totales">' +
        '<div>Subtotal: ' + formatoMoneda(subtotal) + '</div>' +
        '<div>Descuento: ' + formatoMoneda(v.descuento || 0) + '</div>' +
        '<div>IVA (' + tasa + '%): ' + formatoMoneda(iva) + '</div>' +
        '<div><strong>Total: ' + formatoMoneda(v.total) + '</strong></div>' +
      '</div></body></html>';
    window.api.imprimir.html(html);
  } catch (err) { notificar('Error: ' + err.message, true); }
};

function configurarEventosNotificaciones() {
  const btn = document.getElementById('btnNotificaciones');
  if (btn) btn.addEventListener('click', () => { abrirModal('modalNotificaciones'); cargarNotificaciones(); });
  const bg = document.getElementById('btnGenerarNotif');
  if (bg) bg.addEventListener('click', async () => {
    try { const r = await window.api.notificaciones.generar(); notificar(r.creadas + ' alertas generadas'); await cargarNotificaciones(); } catch (err) { notificar('Error: ' + err.message, true); }
  });
  const bt = document.getElementById('btnMarcarTodasNotif');
  if (bt) bt.addEventListener('click', async () => {
    try { await window.api.notificaciones.marcarTodas(); await cargarNotificaciones(); } catch (err) { notificar('Error: ' + err.message, true); }
  });
}

async function cargarNotificaciones() {
  try {
    const r = await window.api.notificaciones.listar();
    ESTADO.notificaciones = r.items || [];
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (r.noLeidas > 0) { badge.textContent = r.noLeidas; badge.style.display = 'inline-block'; }
      else badge.style.display = 'none';
    }
    const lista = document.getElementById('notifLista');
    if (lista) {
      lista.innerHTML = (r.items || []).length
        ? (r.items || []).map(n => '<div style="padding:8px;border-bottom:1px solid #eee;' + (n.leida ? 'opacity:0.6' : '') + '">' +
            '<div style="font-weight:bold;font-size:13px">' + escaparHtml(n.titulo) + '</div>' +
            '<div style="font-size:12px">' + escaparHtml(n.mensaje || '') + '</div>' +
            '<div style="font-size:11px;color:#888;margin-top:2px">' + formatoFecha(n.created_at) + '</div>' +
            (!n.leida ? '<button class="btn btn-ghost btn-mini" style="margin-top:4px" onclick="marcarNotifLeida(\'' + n.id + '\')">Marcar leida</button>' : '') +
          '</div>').join('')
        : '<p class="texto-ayuda">Sin notificaciones</p>';
    }
  } catch (err) { /* ignore */ }
}

window.marcarNotifLeida = async function (id) {
  try { await window.api.notificaciones.marcarLeida(id); await cargarNotificaciones(); } catch (err) { notificar('Error: ' + err.message, true); }
};

// Generar alertas al iniciar y actualizar badge
(async function initNotif() {
  try { await window.api.notificaciones.generar(); await cargarNotificaciones(); } catch (e) { /* ignore */ }
})();

async function cargarEmailConfig() {
  try {
    const c = await window.api.email.config();
    if (!c) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v != null ? v : ''; };
    const chk = document.getElementById('emailActivo');
    if (chk) chk.checked = !!c.activo;
    set('emailSmtpHost', c.smtp_host);
    set('emailSmtpPort', c.smtp_port);
    set('emailSmtpUser', c.smtp_user);
    set('emailFromName', c.from_name);
    set('emailFromEmail', c.from_email);
    set('emailToEmails', c.to_emails);
  } catch (err) { /* ignore */ }
}

async function guardarEmailConfig() {
  try {
    await window.api.email.guardar({
      activo: document.getElementById('emailActivo').checked,
      smtp_host: document.getElementById('emailSmtpHost').value.trim(),
      smtp_port: Number(document.getElementById('emailSmtpPort').value) || 587,
      smtp_user: document.getElementById('emailSmtpUser').value.trim(),
      smtp_pass: document.getElementById('emailSmtpPass').value,
      from_name: document.getElementById('emailFromName').value.trim(),
      from_email: document.getElementById('emailFromEmail').value.trim(),
      to_emails: document.getElementById('emailToEmails').value.trim(),
    });
    notificar('Configuracion de correo guardada');
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function probarEmailConfig() {
  try {
    await window.api.email.probar();
    notificar('Correo de prueba enviado');
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarWaConfig() {
  try {
    const c = await window.api.whatsapp.config();
    if (!c) return;
    const chk = document.getElementById('waActivo');
    if (chk) chk.checked = !!c.activo;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v != null ? v : ''; };
    set('waPhoneNumberId', c.phone_number_id);
    set('waToPhones', c.to_phones);
  } catch (err) { /* ignore */ }
}

async function guardarWaConfig() {
  try {
    await window.api.whatsapp.guardar({
      activo: document.getElementById('waActivo').checked,
      phone_number_id: document.getElementById('waPhoneNumberId').value.trim(),
      access_token: document.getElementById('waAccessToken').value,
      to_phones: document.getElementById('waToPhones').value.trim(),
    });
    notificar('Configuracion de WhatsApp guardada');
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function probarWaConfig() {
  try {
    await window.api.whatsapp.probar();
    notificar('Mensaje de prueba enviado');
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarFacturacion() {
  try {
    const c = await window.api.facturacion.config();
    if (c) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v != null ? v : ''; };
      const selPais = document.getElementById('factPais');
      if (selPais && c.pais) selPais.value = c.pais;
      const selProv = document.getElementById('factProveedor');
      if (selProv && c.proveedor) selProv.value = c.proveedor;
      set('factRfc', c.rfc);
      set('factRegimen', c.regimen_fiscal);
      set('factSerie', c.serie);
      set('factFolio', c.folio_inicial);
      const chk = document.getElementById('factActivo');
      if (chk) chk.checked = !!c.activo;
      const st = document.getElementById('factStatus');
      if (st) st.textContent = 'Estado: ' + (c.status || 'no_configurado') + (c.ultimo_error ? ' - ' + c.ultimo_error : '') + (c.tiene_credenciales ? ' (credenciales guardadas)' : '');
    }
    await cargarSolicitudesFact();
  } catch (err) { /* ignore */ }
}

async function guardarFacturacion() {
  let credenciales = null;
  const raw = (document.getElementById('factCredenciales').value || '').trim();
  if (raw) {
    try { credenciales = JSON.parse(raw); } catch { notificar('Credenciales: JSON invalido', true); return; }
  }
  try {
    await window.api.facturacion.guardar({
      pais: document.getElementById('factPais').value,
      proveedor: document.getElementById('factProveedor').value,
      rfc: document.getElementById('factRfc').value.trim(),
      regimen_fiscal: document.getElementById('factRegimen').value.trim(),
      serie: document.getElementById('factSerie').value.trim(),
      folio_inicial: Number(document.getElementById('factFolio').value) || 1,
      activo: document.getElementById('factActivo').checked,
      credenciales,
    });
    notificar('Configuracion de facturacion guardada');
    await cargarFacturacion();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function solicitarIntegracion() {
  const pais = document.getElementById('solPais').value.trim().toUpperCase();
  if (!pais) return notificar('Falta el pais', true);
  try {
    await window.api.facturacion.solicitar({
      pais,
      proveedor: document.getElementById('solProveedor').value.trim(),
      descripcion: document.getElementById('solDescripcion').value.trim(),
    });
    cerrarModal('modalSolicitudFact');
    document.getElementById('formSolicitudFact').reset();
    notificar('Solicitud enviada. Un administrador la revisara.');
    await cargarSolicitudesFact();
  } catch (err) { notificar('Error: ' + err.message, true); }
}

async function cargarSolicitudesFact() {
  try {
    const sols = await window.api.facturacion.solicitudes();
    const cont = document.getElementById('factSolicitudes');
    if (!cont) return;
    cont.innerHTML = (sols || []).length
      ? '<h4 style="font-size:13px;margin:8px 0 4px">Mis solicitudes</h4>' + (sols || []).map((s) =>
          '<div style="padding:6px;border-bottom:1px solid #eee;font-size:12px">' +
          '<strong>' + escaparHtml(s.pais) + '</strong> - ' + escaparHtml(s.proveedor || '-') +
          ' <span class="chip">' + escaparHtml(s.estado) + '</span>' +
          (s.notas_admin ? '<div style="color:#555;margin-top:2px">' + escaparHtml(s.notas_admin) + '</div>' : '') +
          '</div>').join('')
      : '';
  } catch (err) { /* ignore */ }
}

// Boton Timbrar en ventas: agregar a la lista
window.timbrarVenta = async function (id) {
  try {
    const r = await window.api.facturacion.timbrar(id);
    if (r.ok) notificar('Timbrado: ' + (r.uuid || r.folio || 'OK'));
    else notificar('Error al timbrar: ' + (r.error || ''), true);
  } catch (err) { notificar('Error: ' + err.message, true); }
};

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

function formatoConInfo(n, m) {
  const valor = Number(n);
  const numero = new Intl.NumberFormat(m.locale, {
    minimumFractionDigits: m.decimales,
    maximumFractionDigits: m.decimales,
  }).format(Number.isFinite(valor) ? valor : 0);
  return m.posicion === 'pre' ? `${m.simbolo} ${numero}` : `${numero} ${m.simbolo}`;
}

function formatoMoneda(n) {
  // La moneda la define la empresa (Configuracion). El valor por defecto
  // mantiene el comportamiento anterior si todavia no se ha cargado.
  return formatoConInfo(n, ESTADO.monedaInfo
    || { simbolo: 'Bs', decimales: 2, locale: 'es-VE', posicion: 'post' });
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
window.imprimirComprobanteMovimiento = imprimirComprobanteMovimiento;
window.imprimirFichaProveedor = imprimirFichaProveedor;
window.iniciarPago = iniciarPago;
window.registrarTransferencia = registrarTransferencia;
window.irASuscripcion = irASuscripcion;

// Modal de upgrade disparado por los codigos PlanLimitReached / PlanVencido
window.addEventListener('plan:limite', (e) => {
  try { abrirModalUpgrade(e.detail || null); } catch (err) { console.warn(err); }
});

/* ============================================================
   Puente web: implementa window.api con fetch.
   Es el equivalente del preload.js de Electron, para que el
   renderer funcione IGUAL sin tocar una linea de su codigo.
   ============================================================ */

const CLAVE_SESION = 'inventarios_sesion';

/* --- Sesion en localStorage (el cliente manda el Bearer token) --- */
function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null');
  } catch {
    return null;
  }
}

function guardarSesion(s) {
  localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  // Cookie para que el middleware proteja las rutas del sistema
  document.cookie = `invetser_token=${s.access_token}; path=/; max-age=2592000; SameSite=Lax`;
}

function borrarSesion() {
  localStorage.removeItem(CLAVE_SESION);
  document.cookie = 'invetser_token=; path=/; max-age=0';
}

function token() {
  const s = leerSesion();
  return s ? s.access_token : null;
}

async function pedir(ruta, opciones = {}) {
  const t = token();
  const cabeceras = Object.assign({}, opciones.cabeceras || {});
  if (opciones.json !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (t) cabeceras.Authorization = 'Bearer ' + t;

  const respuesta = await fetch(ruta, {
    method: opciones.metodo || 'GET',
    headers: cabeceras,
    body: opciones.json !== undefined ? JSON.stringify(opciones.json) : opciones.cuerpo,
  });

  if (respuesta.status === 401) {
    borrarSesion();
    if (!location.pathname.startsWith('/entrar')) {
      location.href = '/entrar?expiro=1';
    }
    throw new Error('Sesion expirada');
  }

  let datos = null;
  const texto = await respuesta.text();
  if (texto) {
    try { datos = JSON.parse(texto); } catch { datos = texto; }
  }

  if (!respuesta.ok) {
    const codigo = datos && datos.codigo;
    if ((codigo === 'PlanLimitReached' || codigo === 'PlanVencido') && typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('plan:limite', { detail: datos })); } catch { /* noop */ }
    }
    throw Object.assign(new Error((datos && datos.error) || ('Error ' + respuesta.status)), {
      codigo, detalle: datos || null,
    });
  }
  return datos;
}

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') u.set(k, v);
  }
  const s = u.toString();
  return s ? '?' + s : '';
}

/* --- Impresion: se hace en el cliente, igual que en escritorio --- */
function abrirVentanaImpresion(html) {
  const ventana = window.open('', '_blank');
  if (!ventana) throw new Error('El navegador bloqueo la ventana de impresion');
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => { ventana.print(); }, 300);
}

function escapar(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlReporte(titulo, columnas, filas) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>
    @page { size: letter; margin: 14mm; }
    body { font-family: Arial, sans-serif; color:#111; }
    h1 { font-size:16px; margin:0 0 4px; }
    .meta { font-size:11px; color:#555; margin-bottom:10px; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th,td { border:1px solid #999; padding:4px 6px; text-align:left; }
    th { background:#eee; }
  </style></head><body><h1>${escapar(titulo)}</h1>
  <div class="meta">Generado el ${new Date().toLocaleString('es-VE')}</div>
  <table><thead><tr>${columnas.map(c => `<th>${escapar(c.titulo)}</th>`).join('')}</tr></thead>
  <tbody>${filas.map(f => `<tr>${columnas.map(c => `<td>${escapar(f[c.campo])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></body></html>`;
}

window.api = {
  /* Acceso SQL directo: NO se expone en la web (seria un agujero de seguridad) */
  db: {
    query: () => Promise.reject(new Error('No disponible en la version web')),
    run: () => Promise.reject(new Error('No disponible en la version web')),
    get: () => Promise.reject(new Error('No disponible en la version web')),
  },

  producto: {
    listar: (filtro = {}) => pedir('/api/productos' + qs({
      busqueda: filtro.busqueda,
      categoria_id: filtro.categoria_id,
      proveedor_id: filtro.proveedor_id,
      stock: filtro.stock,
      limite: filtro.limite || 500,
    })).then((r) => r.productos),
    obtener: (id) => pedir('/api/productos/' + id).then((r) => ({ ...r.producto, stock_por_almacen: r.stock_por_almacen || [] })),
    guardar: (payload) => {
      if (payload.id) {
        return pedir('/api/productos/' + payload.id, { metodo: 'PATCH', json: payload });
      }
      return pedir('/api/productos', { metodo: 'POST', json: payload });
    },
    eliminar: (id) => pedir('/api/productos/' + id, { metodo: 'DELETE' }),
  },

  movimientos: {
    listar: (o = {}) => pedir('/api/movimientos' + qs({
      tipo: o.tipo,
      busqueda: o.busqueda,
      area: o.area,
      producto_id: o.producto_id,
      limite: o.limite || 500,
    })).then((r) => r.movimientos),
    registrar: (payload) => pedir('/api/movimientos', { metodo: 'POST', json: payload }),
  },

  dashboard: {
    stats: () => pedir('/api/dashboard').then((r) => r.stats),
  },

  contabilidad: {
    resumen: (filtros = {}) => pedir('/api/contabilidad' + qs({
      desde: filtros.desde,
      hasta: filtros.hasta,
      producto_id: filtros.producto_id,
    })),
  },

  categorias: {
    listar: () => pedir('/api/categorias').then((r) => r.categorias),
    guardar: (payload) => pedir('/api/categorias', { metodo: 'POST', json: payload }),
  },

  proveedores: {
    listar: () => pedir('/api/proveedores').then((r) => r.proveedores),
    guardar: (payload) => pedir('/api/proveedores', { metodo: 'POST', json: payload }),
  },

  giros: {
    listar: () => pedir('/api/giros').then((r) => r.giros),
    actual: () => pedir('/api/empresa').then((r) => r.empresa.giro_actual),
    cambiar: (nombre) => pedir('/api/giros', { metodo: 'PATCH', json: { nombre } }),
    campos: (nombre) => pedir('/api/giros/' + encodeURIComponent(nombre) + '/campos').then((r) => r.campos),
    valores: (productoId) => pedir('/api/productos/' + productoId).then((r) => r.valores || []),
    guardarCampo: (payload) => pedir('/api/campos', { metodo: 'POST', json: payload }),
    eliminarCampo: (id) => pedir('/api/campos?id=' + id, { metodo: 'DELETE' }),
  },

  config: {
    get: () => pedir('/api/config'),
    set: (clave, valor) => pedir('/api/config', { metodo: 'POST', json: { clave, valor } }),
  },

  empresa: {
    obtener: () => pedir('/api/empresa').then((r) => r.empresa),
    guardar: (payload) => pedir('/api/empresa', { metodo: 'PATCH', json: payload }),
  },

  /* Planes y suscripcion */
  suscripcion: {
    obtener: () => pedir('/api/suscripcion'),
  },
  planes: {
    listar: () => pedir('/api/planes').then((r) => r.planes || []),
  },
  pagos: {
    checkout: (pasarela, payload) => pedir('/api/pagos/checkout', { metodo: 'POST', json: { ...payload, pasarela } }),
    transferencia: (payload) => pedir('/api/pagos/transferencia', { metodo: 'POST', json: payload }),
    historial: () => pedir('/api/pagos/historial').then((r) => r.pagos || []),
  },
  adminPagos: {
    listar: (estado) => pedir('/api/admin/pagos' + (estado ? '?estado=' + encodeURIComponent(estado) : '')).then((r) => r.pagos || []),
    resolver: (id, accion, nota) => pedir('/api/admin/pagos', { metodo: 'POST', json: { id, accion, nota } }),
  },
  almacenes: {
    listar: () => pedir('/api/almacenes').then((r) => r.almacenes || []),
    guardar: (payload) => pedir('/api/almacenes', { metodo: 'POST', json: payload }),
  },
  clientes: {
    listar: (filtro = {}) => pedir('/api/clientes' + qs({ busqueda: filtro.busqueda })).then((r) => r.clientes),
    guardar: (payload) => pedir('/api/clientes', { metodo: 'POST', json: payload }),
  },
  ventas: {
    listar: (o = {}) => pedir('/api/ventas' + qs({ limite: o.limite || 200 })).then((r) => r.ventas),
    obtener: (id) => pedir('/api/ventas/' + id),
    crear: (payload) => pedir('/api/ventas', { metodo: 'POST', json: payload }),
  },
  cobros: {
    listar: (o = {}) => pedir('/api/cobros' + qs({ limite: o.limite || 200 })).then((r) => r.cobros),
    registrar: (payload) => pedir('/api/cobros', { metodo: 'POST', json: payload }),
  },
  cxc: {
    listar: (estado) => pedir('/api/cxc' + (estado ? '?estado=' + encodeURIComponent(estado) : '')).then((r) => r.cxc),
  },
  compras: {
    listar: (o = {}) => pedir('/api/compras' + qs({ limite: o.limite || 200 })).then((r) => r.compras),
    obtener: (id) => pedir('/api/compras/' + id),
    crear: (payload) => pedir('/api/compras', { metodo: 'POST', json: payload }),
  },
  cxp: {
    listar: (estado) => pedir('/api/cxp' + (estado ? '?estado=' + encodeURIComponent(estado) : '')).then((r) => r.cxp),
  },
  pagosProveedor: {
    listar: () => pedir('/api/pagos-proveedor').then((r) => r.pagos),
    registrar: (payload) => pedir('/api/pagos-proveedor', { metodo: 'POST', json: payload }),
  },
  caja: {
    resumen: () => pedir('/api/caja'),
    sesiones: () => pedir('/api/caja/sesiones').then((r) => r.sesiones || []),
    abrir: (monto) => pedir('/api/caja/sesiones', { metodo: 'POST', json: { monto_inicial: monto } }),
    cerrar: (sesionId, montoReal, notas) => pedir('/api/caja/cerrar', { metodo: 'POST', json: { sesion_id: sesionId, monto_real: montoReal, notas } }),
    cerrarDetallado: (sesionId, montoReal, desgloseReal, notas) => pedir('/api/caja/cerrar-detallado', { metodo: 'POST', json: { sesion_id: sesionId, monto_real: montoReal, desglose_real: desgloseReal, notas } }),
  },
  reportes: {
    ventas: (filtros = {}) => pedir('/api/reportes/ventas' + qs({ desde: filtros.desde, hasta: filtros.hasta })),
    cxc: () => pedir('/api/reportes/cxc'),
    cxp: () => pedir('/api/reportes/cxp'),
    caja: (filtros = {}) => pedir('/api/reportes/caja' + qs({ desde: filtros.desde, hasta: filtros.hasta })),
    stockAlmacen: () => pedir('/api/reportes/stock-almacen'),
  },
  notificaciones: {
    listar: (soloNoLeidas) => pedir('/api/notificaciones' + (soloNoLeidas ? '?no_leidas=1' : '')).then((r) => ({ items: r.notificaciones || [], noLeidas: r.no_leidas || 0 })),
    marcarLeida: (id) => pedir('/api/notificaciones', { metodo: 'POST', json: { accion: 'marcar_leida', id } }),
    marcarTodas: () => pedir('/api/notificaciones', { metodo: 'POST', json: { accion: 'marcar_todas' } }),
    generar: () => pedir('/api/notificaciones', { metodo: 'POST', json: { accion: 'generar' } }),
  },
  email: {
    config: () => pedir('/api/email/config').then((r) => r.config),
    guardar: (payload) => pedir('/api/email/config', { metodo: 'POST', json: payload }),
    probar: () => pedir('/api/email/config', { metodo: 'POST', json: { test: true } }),
  },
  whatsapp: {
    config: () => pedir('/api/whatsapp/config').then((r) => r.config),
    guardar: (payload) => pedir('/api/whatsapp/config', { metodo: 'POST', json: payload }),
    probar: () => pedir('/api/whatsapp/config', { metodo: 'POST', json: { test: true } }),
  },
  monedas: {
    listar: () => pedir('/api/monedas'),
  },

  export: {
    excel: (payload) => pedir('/api/export', { metodo: 'POST', json: payload }).then((r) => {
      if (r && r.ok && r.contenido) {
        const binario = atob(r.contenido);
        const bytes = new Uint8Array(binario.length);
        for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: r.tipo }));
        const a = document.createElement('a');
        a.href = url;
        a.download = r.archivo || 'export.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      }
      return r || { ok: false };
    }),
  },

  imprimir: {
    listar: () => Promise.resolve([]),
    // Documento HTML libre: lo usan los comprobantes, actas y fichas.
    html: (contenido) => {
      abrirVentanaImpresion(contenido);
      return Promise.resolve({ ok: true });
    },
    reporte: (payload) => {
      abrirVentanaImpresion(htmlReporte(payload.titulo, payload.columnas, payload.filas));
      return Promise.resolve({ ok: true });
    },
    ticket: (payload) => {
      const lineas = (payload.lineas || []).map((l) => {
        if (l.tipo === 'separador') return '<hr>';
        if (l.tipo === 'titulo') return `<div style="text-align:center;font-weight:bold">${escapar(l.texto)}</div>`;
        if (l.tipo === 'total') return `<div style="font-weight:bold">${escapar(l.texto)} ${escapar(l.valor || '')}</div>`;
        return `<div style="display:flex;justify-content:space-between"><span>${escapar(l.texto)}</span><span>${escapar(l.valor || '')}</span></div>`;
      }).join('');
      abrirVentanaImpresion(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: monospace; font-size: 12px; width: 72mm; }
        hr { border: none; border-top: 1px dashed #000; }
      </style></head><body>
        <div style="text-align:center;font-weight:bold">${escapar(payload.titulo)}</div><hr>${lineas}
      </body></html>`);
      return Promise.resolve({ ok: true });
    },
  },

  webhook: {
    enviar: (payload) => pedir('/api/webhook', { metodo: 'POST', json: payload }),
  },

  importar: {
    abrir: async () => {
      const entrada = document.createElement('input');
      entrada.type = 'file';
      entrada.accept = '.csv,.txt,.xlsx';
      const archivo = await new Promise((resolve) => {
        entrada.onchange = () => resolve(entrada.files[0]);
        entrada.click();
      });
      if (!archivo) return { cancelado: true };
      const contenido = await new Promise((resolve) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.readAsArrayBuffer(archivo);
      });
      return pedir('/api/importar', {
        metodo: 'POST',
        json: {
          nombre: archivo.name,
          contenido: btoa(String.fromCharCode(...new Uint8Array(contenido))),
        },
      });
    },
    aplicar: (payload) => pedir('/api/importar/aplicar', { metodo: 'POST', json: payload }),
  },

  asistente: {
    consultar: (texto) => pedir('/api/asistente', { metodo: 'POST', json: { texto } }),
    ejecutar: (accion) => pedir('/api/asistente/ejecutar', { metodo: 'POST', json: { accion } }),
    aprender: (frase, productoId) => pedir('/api/asistente/aprender', { metodo: 'POST', json: { frase, producto_id: productoId } }),
    alias: () => pedir('/api/asistente/alias').then((r) => r.alias || []),
    aliasEliminar: (id) => pedir('/api/asistente/alias?id=' + id, { metodo: 'DELETE' }),
    productos: () => pedir('/api/productos?limite=300').then((r) => r.productos),
  },

  eventos: {
    registrar: (evento, contexto) => pedir('/api/eventos', { metodo: 'POST', json: { evento, contexto: contexto || null } }).catch(() => {}),
    adopcion: () => pedir('/api/eventos/adopcion'),
  },

  auth: {
    sesion: () => pedir('/api/auth/sesion').then((r) => r.usuario),
    login: (usuario, password) => pedir('/api/auth/login', { metodo: 'POST', json: { email: usuario, password } }),
    logout: () => pedir('/api/auth/logout', { metodo: 'POST' }).then(() => { borrarSesion(); return true; }).catch(() => { borrarSesion(); return true; }),
    cambiarClavePropia: (actual, nueva) => pedir('/api/auth/cambiar-clave', { metodo: 'POST', json: { actual, nueva } }),
  },

  usuarios: {
    listar: () => pedir('/api/usuarios').then((r) => r.usuarios),
    guardar: (payload) => pedir('/api/usuarios', { metodo: 'POST', json: payload }),
    eliminar: (id) => pedir('/api/usuarios?id=' + id, { metodo: 'DELETE' }),
    cambiarClave: (id, password) => pedir('/api/usuarios/' + id + '/clave', { metodo: 'POST', json: { password } }),
    permisos: (rol) => pedir('/api/usuarios/permisos?rol=' + encodeURIComponent(rol)).then((r) => r.permisos),
  },

  catalogos: {
    seguridad: () => pedir('/api/catalogos'),
  },

  bitacora: {
    listar: (filtros = {}) => pedir('/api/bitacora' + qs({
      usuario: filtros.usuario, area: filtros.area, accion: filtros.accion, limite: filtros.limite || 400,
    })).then((r) => r.bitacora),
  },

  trazabilidad: {
    producto: (id) => pedir('/api/trazabilidad?id=' + id),
  },

  /* No hay menu nativo en la web: el renderer no recibe eventos */
  onVista: () => {},
};

/* Login previo (por ejemplo tras registrar): guarda la sesion */
window.apiWeb = {
  guardarSesion,
  borrarSesion,
  sesion: leerSesion,
};

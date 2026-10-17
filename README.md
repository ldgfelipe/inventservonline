# Sistema de Inventarios Online

Version web del sistema de inventarios, para que tus clientes se **registren solos** y lo usen desde cualquier equipo. Corre en Vercel con Supabase.

## Arquitectura

La decision clave: **el renderer es el mismo que la version de escritorio**. En vez de reescribir la interfaz, se copio tal cual a `public/renderer/` y se le enchufo `js/api-web.js`, que implementa la misma interfaz `window.api` que el `preload.js` de Electron, pero hablando con la API de Next.js por `fetch`.

```
 src/app/            paginas (landing, registro, entrar, panel) y rutas API
 src/services/       logica compartida con la version de escritorio
   permisos.js       roles y permisos
   texto.js          normalizacion, numeros, similitud
   nlu.js            motor de intenciones del asistente
   analisisImportacion.js  mapeo de columnas y deteccion de duplicados
 public/renderer/    la interfaz, sin modificar
 sql/001_schema.sql  esquema Postgres + funciones + RLS
 middleware.js       protege /panel, /renderer y /api/*
```

## Cómo se aíslan los datos (leer esto)

El sistema usa **dos clientes de Supabase**, y la razón es importante:

| Cliente | Para qué | Por qué |
|---|---|---|
| `service_role` (`sb`) | Consultas a tablas | No depende de las políticas RLS. Si el RLS está mal configurado, el sistema **sigue funcionando**. |
| JWT del usuario (`sbRpc`) | Llamar funciones (`rpc`) | Las funciones derivan la empresa de `auth.uid()`; con `service_role` ese valor es `null`. |

**El aislamiento por empresa se aplica filtrando `empresa_id` en cada consulta.** Todas las rutas lo hacen: `productos`, `movimientos`, `categorias`, `proveedores`, `bitacora`, `trazabilidad`, `usuarios`, `asistente`, `importar`.

Las políticas RLS quedan como **segunda capa de defensa**: si algún día se configuran correctamente, añaden protección extra; si no, no bloquean nada. Esta decisión se tomó tras un incidente real en el que un RLS a medio aplicar dejaba el sistema inutilizable con un error indescifrable.

Si en el futuro quieres volver a hacer del RLS la capa principal, ejecuta `sql/006_repair_rls.sql`, verifica con `/diagnostico` que `auth.uid()` no es null, y entonces cambia `sb` por `sbRpc` en `src/lib/auth.js`.

## Multi-inquilino (cada cliente ve solo lo suyo)

Cada registro pertenece a una **empresa**. El aislamiento no se hace en el codigo de la aplicacion, sino con **Row Level Security en Postgres**: aunque una ruta se equivoque, un usuario no puede leer datos de otra empresa.

```
auth.users ──1:1── perfiles ──N:1── empresas ──1:N── productos, movimientos, ...
                                                    categorias, proveedores, ...
```

- `empresa_actual()` devuelve la empresa del usuario autenticado
- Todas las tablas de datos tienen `empresa_id` y policies de select/insert/update/delete
- El catalogo (`giros`, `campos_giro`) es compartido y de solo lectura
- Las rutas de datos usan un cliente de Supabase con el **JWT del usuario**, asi que el RLS decide que ve

## Registro online

`POST /api/auth/registro` crea, en una sola operacion:

1. El usuario en `auth.users` (con el email confirmado, para no obligar a revisar el correo en el piloto)
2. La **empresa** (inquilino)
3. El **perfil** como `admin` de esa empresa
4. Una categoria `General` para no arrancar vacio

Si algo falla a mitad, **borra el usuario creado** para no dejar cuentas huerfanas. Devuelve la sesion, asi que el cliente entra directo sin pasos extra.

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. **SQL Editor**, pega `sql/001_schema.sql` y ejecutalo
3. En **Project Settings → API** copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

### 2. Local

```bash
npm install
cp .env.example .env.local    # rellena los valores
npm run dev
```

Abre http://localhost:3000, crea una cuenta en `/registro` y entra.

### Cuenta de demostración

Para que cualquiera pueda probar el sistema sin registrarse, ejecuta `sql/009_demo_abarrotes.sql` en el **SQL Editor de Supabase**. Crea una tienda de abarrotes con 15 productos precargados y una cuenta demo:

| Campo | Valor |
|-------|-------|
| Email | `demo@abarrotes.com` |
| Contraseña | `demo123456` |
| Empresa | Abarrotes La Esquina (plan trial) |
| Giro | Supermercado y abastos |
| Rol | admin de la empresa (no super_admin) |

La landing (`/`) muestra un botón **"Probar el sistema"** que autentica con esas credenciales y redirige al panel. Cambia la contraseña en producción.

### 3. Vercel

```bash
vercel          # o conecta el repo desde el dashboard
```

Anade las mismas variables en **Vercel → Project → Settings → Environment Variables**.

## API

Todas las respuestas son JSON con `{ ok, ... }` y exigen `Authorization: Bearer <token>` salvo las publicas.

| Ruta | Descripcion |
|---|---|
| `POST /api/auth/registro` | Registro online (publica) |
| `POST /api/auth/login` | Iniciar sesion (publica) |
| `POST /api/auth/logout` | Cerrar sesion (publica) |
| `GET /api/auth/sesion` | Perfil del usuario actual |
| `GET/POST /api/productos` | Listar y crear productos |
| `GET/PATCH/DELETE /api/productos/[id]` | Ver, editar y eliminar |
| `GET/POST /api/movimientos` | Historial y registro de entradas/salidas |
| `GET /api/dashboard` | Metricas agregadas |
| `GET/POST /api/categorias`, `/api/proveedores` | Catalogos |
| `GET/PATCH /api/giros` | Giros y giro activo de la empresa |
| `GET /api/giros/[nombre]/campos` | Campos personalizados de un giro |
| `POST/DELETE /api/campos` | Crear y eliminar campos |
| `GET/POST /api/usuarios` | Gestion de usuarios de la empresa |
| `GET /api/catalogos` | Roles, areas y permisos |
| `POST /api/export` | Exportar a Excel |
| `POST /api/importar` | Analizar un CSV/XLSX |
| `POST /api/importar/aplicar` | Aplicar el plan revisado |
| `POST /api/asistente` | Consultar al asistente |
| `POST /api/asistente/ejecutar` | Confirmar una accion del asistente |
| `GET/DELETE /api/asistente/alias` | Alias aprendidos |
| `GET /api/bitacora` | Registro auditable |
| `GET /api/trazabilidad?id=` | Historial completo de un producto |
| `GET /api/eventos/adopcion` | Metricas de uso y abandono |
| `GET /api/planes` | Catalogo de planes (publica) |
| `GET /api/suscripcion` | Plan actual, vigencia y consumo de la empresa |
| `GET/POST /api/compras`, `/api/compras/[id]` | Compras a proveedores + detalle |
| `GET /api/cxc` | Cuentas por cobrar |
| `GET /api/cxp` | Cuentas por pagar |
| `GET/POST /api/cobros` | Cobros (caja) |
| `GET/POST /api/pagos-proveedor` | Pagos a proveedores |
| `GET /api/reportes/ventas` | Reporte de ventas con margen |
| `GET /api/reportes/cxc` | Antiguedad de CxC |
| `GET /api/reportes/cxp` | Antiguedad de CxP |
| `GET /api/reportes/caja` | Resumen de caja por periodo |
| `GET/POST /api/clientes` | Clientes |
| `POST /api/pagos/checkout` | Inicia un pago (Stripe / Mercado Pago / PayPal) |
| `POST /api/pagos/transferencia` | Registra una transferencia con comprobante (queda en revision) |
| `GET /api/pagos/historial` | Pagos de la empresa |
| `GET/POST /api/admin/pagos` | Super-admin: listar y aprobar/rechazar pagos |
| `POST /api/webhooks/stripe`, `/mercadopago`, `/paypal` | Webhooks de pasarelas (publicos) |

## Roles

| Rol | Alcance |
|---|---|
| `admin` | Todo, incluidos usuarios y configuracion |
| `supervisor` | Todo lo operativo y reportes; sin gestionar usuarios |
| `almacenista` | Entradas/salidas y productos; sin usuarios/config/webhook |
| `consultor` | Solo lectura |

Los roles y permisos viven en `src/services/permisos.js`, compartido con la version de escritorio, asi que ambos sistemas se comportan igual.

## Funciones Postgres

`sql/001_schema.sql` incluye funciones que hacen en la base lo que no conviene hacer desde la API:

- `registrar_movimiento(...)`: actualiza el stock e inserta el movimiento **en una transaccion atomica**, y valida stock insuficiente. Son dos operaciones que nunca deben quedar a medias.
- `metricas_dashboard(...)`, `metricas_adopcion(...)`: agregan con SQL en vez de traer todos los productos. Con muchos datos es la diferencia entre segundos y milisegundos.
- `top_movidos(...)`: productos con mas movimiento.

## Migraciones SQL

Ejecuta los archivos de `sql/` **en orden** en el SQL Editor de Supabase. Todos son idempotentes (se pueden repetir sin romper nada):

| Archivo | Contenido |
|---|---|
| `001_schema.sql` | Tablas, funciones, RLS y datos semilla |
| `002_admin_y_giros.sql` | Claves de administrador y catalogo de giros |
| `003_crear_admin.sql` | Creacion de administradores |
| `004_diagnostico.sql` | Comprobaciones de diagnostico |
| `005_reparar_perfil.sql` | Reparacion del perfil |
| `006_repair_rls.sql` | Reconstruccion de las policies RLS |
| `007_diagnostico.sql` | Comprobaciones de diagnostico |
| `008_giros_descripciones.sql` | Descripciones de giros |
| `009_demo_abarrotes.sql` | Datos demo |
| `010_almacen_y_contabilidad.sql` | Campos de almacen, costo promedio y contabilidad |
| `011_demo_ampliado.sql` | Datos demo ampliados |
| `012_pais_y_moneda.sql` | Pais y moneda por empresa |
| `013_planes_freemium.sql` | Planes, suscripcion, multi-almacen y pagos SaaS |
| `014_comercial.sql` | Clientes, ventas, cobros, CxC, compras, CxP y pagos a proveedores |
| `015_multi_almacen.sql` | Multi-almacen real: registrar_movimiento/venta/compra con almacen + producto_almacen |

## Planes, freemium y limites

- El **catalogo de planes y sus limites** vive en `src/lib/planes.js` (modulo puro): planes `free`, `basic` y `pro`, con limites de productos, usuarios, proveedores y almacenes (multi-almacen solo en `pro`).
- `src/lib/licenciamiento.js` valida, en el servidor, la **suscripcion** (plan, estado y vencimiento) y el **consumo** antes de crear registros. Lo usan `POST /api/productos`, `POST /api/proveedores`, `POST /api/usuarios` y `POST /api/almacenes`.
- Si se supera un limite, la API responde `403` con `codigo: "PlanLimitReached"` (y `recurso`, `limite`, `uso`, `plan`). Si la suscripcion vencio, responde `402` con `codigo: "PlanVencido"`. El frontend usa esos codigos para abrir el modal de upgrade.
- **Resiliencia**: si la migracion `013` aun no esta aplicada, no se aplican limites y el sistema opera con normalidad.
- La suscripcion por empresa se guarda en `suscripciones_empresas` (plan + estado + vigencia). Al registrarse, la empresa arranca con plan `pro` en estado `trial` (`DIAS_PRUEBA` dias, definidos en `src/lib/planes.js`). Las cuentas que ya existian quedan activas (grandfathered).

## Pagos y pasarelas

- `src/lib/pasarelas.js` integra **Stripe** (Checkout Sessions), **Mercado Pago** (Preferences) y **PayPal** (Orders v2) usando `fetch` y `node:crypto`, **sin dependencias nuevas**.
- `src/lib/pagos.js` maneja precios (desde `planes.js`), el registro de pagos en `pagos_saas_historial` y la activacion/extension de `suscripciones_empresas` (y refleja `empresas.plan`).
- El **pago online** se inicia en `POST /api/pagos/checkout`: crea un pago `pendiente` y devuelve la URL de la pasarela. El webhook correspondiente lo confirma y activa el plan.
- La **transferencia manual** se registra en `POST /api/pagos/transferencia` con la URL del comprobante: queda `en_revision` hasta que un super-admin la aprueba en `POST /api/admin/pagos`.
- Los **webhooks** verifican firma (`STRIPE_WEBHOOK_SECRET`, `MERCADOPAGO_WEBHOOK_SECRET`, verificacion de PayPal) y responden `400` si la firma no es valida.
- La app funciona **sin credenciales**: una pasarela no configurada responde `503 PasarelaNoConfigurada`. Ver `.env.example` para las variables (`APP_URL`, `STRIPE_*`, `MERCADOPAGO_*`, `PAYPAL_*`).

## Multi-almacen real

- `registrar_movimiento` acepta `p_almacen` (default: almacen principal de la empresa) y mantiene `producto_almacen` (desglose de stock por ubicacion), ademas de actualizar `productos.stock_actual` (total consolidado) y registrar `almacen_id` en `movimientos`.
- `registrar_venta` y `registrar_compra` propagan `p_almacen` a cada movimiento.
- El selector de almacen esta en el modal de movimiento y en los modales de venta/compra.
- `productos.stock_actual` sigue siendo el total; el desglose por ubicacion vive en `producto_almacen`.

## Modulo comercial (POS / cobranza + cuentas por pagar)

- Tablas: `clientes`, `ventas` + `venta_detalle`, `cobros`, `cuentas_por_cobrar`, `compras` + `compra_detalle`, `cuentas_por_pagar`, `pagos_proveedor`.
- RPCs transaccionales: `registrar_venta`, `registrar_cobro`, `registrar_compra`, `registrar_pago_proveedor`. Reutilizan `registrar_movimiento` para el stock, de modo que cabecera, detalle, stock y cuenta por cobrar/pagar nunca quedan a medias.
- Endpoints: `/api/clientes`, `/api/ventas`, `/api/cobros`, `/api/cxc`, `/api/compras`, `/api/cxp`, `/api/pagos-proveedor`, `/api/caja`.
- Cobros y pagos a proveedores se aplican a la factura indicada o, si no se indica, en orden FIFO a las cuentas pendientes del cliente/proveedor.
- Permisos nuevos: `clientes.*`, `ventas.*`, `cobros.registrar`, `caja.ver`, `cxc.ver`, `compras.*`, `cxp.*`. Admin y supervisor los tienen; almacenista opera ventas/compras; consultor solo lectura.
- La UI de POS (pantalla de venta, caja, CxC/CxP) queda como siguiente paso.

## Administrador de la plataforma

Hay dos niveles distintos, y conviene no confundirlos:

- **Administrador de empresa** (`rol = admin`): es quien crea la cuenta y gestiona su propio inventario, usuarios y configuración. Lo es automáticamente el primero que se registra.
- **Administrador de la plataforma** (`super_admin = true`): tu personal. Accede a `/admin`, ve los perfiles de todas las empresas y gestiona las claves.

### Crear tu primera clave maestra

Después de ejecutar `002_admin_y_giros.sql`, corre esta línea **cambiando el código por uno tuyo**:

```sql
insert into public.claves_admin (codigo, descripcion, max_usos)
values ('TU-CODIGO-SECRETO', 'Clave maestra del sistema', 1);
```

Guárdala. Al registrarte en `/registro`, pulsa *"Tengo una clave de administrador"* e introdúcela: te marcará como `super_admin` y la clave quedará consumida.

Desde `/admin` puedes crear más claves (con usos y vencimiento), activarlas o desactivarlas. **El código solo se muestra al crearla**, igual que una contraseña.

> Una clave no válida o ya usada **bloquea el registro con un error claro** en vez de crear la cuenta sin el nivel esperado.

## Giros del negocio

El catálogo de `002` trae 30 categorías generales (Construcción, Farmacia, Ferretería, Alimentos y bebidas, Restaurante, Ropa y calzado, Electrónica, Veterinaria, Servicios profesionales, etc.). Construcción y Farmacia conservan sus campos específicos; el resto arranca sin campos propios y se les pueden agregar desde Configuración.

El giro se puede cambiar en cualquier momento desde `/admin` o desde **Configuración** dentro del sistema.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor (registro y administracion de usuarios). El navegador usa la clave anonima, y es el **RLS** el que limita lo que puede ver.
- El acceso SQL directo (`window.api.db`) **no existe** en la web: exponer consultas SQL desde el navegador seria un agujero de seguridad.
- Cada ruta vuelve a validar permisos contra el perfil. Ocultar un boton en la interfaz no es control de acceso.
- El middleware protege rutas y API, pero la autorizacion real se decide en cada ruta.

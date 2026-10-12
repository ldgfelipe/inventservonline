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

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor (registro y administracion de usuarios). El navegador usa la clave anonima, y es el **RLS** el que limita lo que puede ver.
- El acceso SQL directo (`window.api.db`) **no existe** en la web: exponer consultas SQL desde el navegador seria un agujero de seguridad.
- Cada ruta vuelve a validar permisos contra el perfil. Ocultar un boton en la interfaz no es control de acceso.
- El middleware protege rutas y API, pero la autorizacion real se decide en cada ruta.

# inventserOnline — Descripción completa del sistema

> Documento generado para análisis externo (IA). Describe la arquitectura, módulos, integraciones y estado actual del SaaS de inventarios multi-tenant.

**Último commit:** `a87481a` (rama `main`)
**URL de producción:** https://inventser.online
**Repo:** git@github.com:ldgfelipe/inventservonline.git
**Stack:** Next.js 16.4.2 (App Router), Supabase (Postgres + Auth + Storage), Node.js, Tailwind-less CSS propio, Vercel.

---

## 1. Visión general

inventserOnline es un **SaaS multi-tenant de inventarios** adaptable a distintos giros de negocio (construcción, farmacia, abarrotes, ferretería, etc.). Cada empresa (inquilino) se registra sola, obtiene 14 días de prueba con plan Profesional y luego elige un plan de pago. El sistema cubre inventario, ventas, compras, caja, contabilidad, reportes, facturación electrónica, alertas, soporte, marketing, tracking y un asistente en lenguaje natural.

Características distintivas:
- Multi-tenant por `empresa_id` (RLS en segunda capa).
- Multi-almacén con traslados y stock por bodega.
- Campos de producto personalizados por giro.
- Freemium con límites por plan y gating de módulos.
- Pasarelas de pago: Stripe, Mercado Pago, PayPal y transferencia manual.
- Asistente NLU local (sin APIs externas) con analítica para decisiones.
- Tracking de campañas y email (UTM, píxel de apertura, honeypot, bajas).
- Conocimiento base y landing pages editables en HTML puro.

---

## 2. Arquitectura

- **Frontend**: Next.js App Router (server components + client components). UI estilo ERP clásico (sidebar + topbar). CSS propio (`globals.css`, `public/renderer/css/styles.css`).
- **Backend**: rutas API en `src/app/api/*` (Node runtime). Lógica de negocio en `src/lib/*` y `src/services/*`.
- **Base de datos**: Supabase Postgres. Tablas por inquilino filtradas por `empresa_id`. RLS como segunda capa.
- **Auth**: Supabase Auth (JWT). El servidor usa `admin()` (service_role) para tablas y `conJwt()` (user JWT) para RPCs.
- **Storage**: bucket `archivos` en Supabase Storage, organizado por `empresas/{empresa_id}/...`.
- **Despliegue**: Vercel (auto-deploy desde `main`), Supabase (DB + Auth + Storage).
- **Middleware** (`middleware.js`): protege `/panel`, `/admin`, `/renderer`, `/api/*`. Rutas públicas: `/`, `/entrar`, `/registro`, `/precios`, `/ayuda`, `/baja`, `/p/*`, `/api/auth/*`, `/api/giros`, `/api/monedas`, `/api/planes`, `/api/webhooks`, `/api/trafico`, `/api/pixel`, `/api/click`, `/api/bajas`, `/api/pixeles`, `/api/landing`.

### Convenciones clave
- `sb` = cliente service_role (consultas filtrando `empresa_id`).
- `sbRpc` = cliente con JWT del usuario (para funciones RPC).
- Los límites de plan viven en `src/lib/planes.js` (módulo puro), no en DB, para funcionar sin migración 013.
- Los errores de licenciamiento (`LimitePlanError`, `PlanVencidoError`, `ModuloNoDisponible`) se detectan por duck-typing (`.respuesta()`).

---

## 3. Módulos del sistema (panel del usuario, `/panel`)

### 3.1 Inventario
- Productos con código, nombre, stock, precios, categoría, proveedor, giro.
- Campos personalizados por giro (lote, espesor, principio activo, etc.).
- Stock por almacén (desglose).
- Categorías.

### 3.2 Movimientos
- Entradas y salidas con trazabilidad (usuario, área, fecha).
- Historial/Kardex.
- Traslados entre almacenes.

### 3.3 Comercial
- Clientes y proveedores.
- Ventas, compras, cobros, pagos a proveedores.
- Cuentas por cobrar (CxC) y por pagar (CxP).
- Caja y sesiones de caja (arqueo).

### 3.4 Contabilidad
- Kardex valorizado (costo promedio ponderado).
- Asientos y reportes contables.

### 3.5 Reportes
- Ventas, margen, CxC/CxP aging, caja por día.
- Exportación a Excel.

### 3.6 Facturación electrónica
- Configuración por país/proveedor (Facturama, SW Sapien, SAT directo, DIAN, AFIP, SUNAT, SII, AEAT).
- Timbrado, PDF impreso, IVA.

### 3.7 Multi-almacén
- Almacenes principales/secundarios, stock por bodega, traslados.

### 3.8 Configuración
- Organizada en pestañas: General, Catálogo, Plan y pagos, Notificaciones, Facturación, Sistema.
- Empresa: nombre, RIF, país, moneda, IVA, logo.
- Giro del negocio y campos personalizados.
- Suscripción y plan (upgrade vía pasarelas).
- Notificaciones por correo (SMTP) y WhatsApp (Meta Cloud API).
- Alertas (stock bajo, agotado, CxC/CxP vencidas, diferencia de caja).
- Webhook de salida de datos.
- Uso y adopción.

### 3.9 Usuarios y permisos
- Roles: Administrador, Supervisor, Almacenista, Consultor.
- Áreas organizacionales.
- Matriz de permisos por nivel.

### 3.10 Bitácora
- Trazabilidad de quién hizo qué y cuándo.
- Filtros por usuario, área, acción.

### 3.11 Asistente de inventario
- Motor NLU local (sin APIs externas).
- Consultas en lenguaje natural: stock, productos bajos/agotados, valor del inventario, movimientos, ventas, CxC, CxP, caja, margen, traslados, stock por almacén.
- Registrar entradas y salidas con confirmación.
- Analítica para decisiones: más vendidos, estancados, compras/rentabilidad por proveedor, rentabilidad por producto, rendimiento por almacén.
- Cambiar mínimos/máximos desde el asistente (con confirmación).
- Enviar avisos entre áreas o usuarios (con confirmación).
- Capa difusa con sinónimos, similitud y sugerencias ("¿Quisiste decir...?").
- Resumen general y recomendaciones priorizadas.

### 3.12 Notificaciones in-app
- Campana de notificaciones en topbar.
- Tipos: stock, CxC, CxP, caja, sistema.
- Filtradas por área/usuario (avisos dirigidos).

---

## 4. Freemium y licenciamiento

### Planes (`src/lib/planes.js`)
| Plan | Precio | Productos | Usuarios | Proveedores | Clientes | Almacenes | Storage |
|---|---|---|---|---|---|---|---|
| Free | $0 | 50 | 1 | 3 | 10 | 1 | 100 MB |
| Básico | $9/mes | 1500 | 3 | 15 | 100 | 1 | 500 MB |
| Pro | $19/mes | ilimitado | ilimitado | ilimitado | ilimitado | ilimitado | 2 GB |
| Empresa | $49/mes | ilimitado | ilimitado | ilimitado | ilimitado | ilimitado | 10 GB |

- Gating de módulos por plan (contabilidad, multi-almacén, POS, compras, CxC, CxP, facturación, asistente, reportes).
- Trial: plan Pro por 14 días (`PLAN_EN_PRUEBA='pro'`, `DIAS_PRUEBA=14`).
- Empresas existentes se grandfaterean como activas.

### Licenciamiento (`src/lib/licenciamiento.js`)
- Verifica límites al crear registros.
- Errores: `LimitePlanError` (403 `PlanLimitReached`), `PlanVencidoError` (402), `ModuloNoDisponible` (403).
- Gating en productos, proveedores, usuarios, almacenes y módulos.

---

## 5. Pagos

### Pasarelas (`src/lib/pasarelas.js`)
- **Stripe** (Checkout Sessions, firma verificada).
- **Mercado Pago** (Preferences).
- **PayPal** (Orders v2, sandbox/live).
- **Transferencia bancaria** (manual, con comprobante y aprobación admin).
- Credenciales en DB (`configuracion_pagos`) con fallback a env vars; caché 30 s.
- Botones de prueba de credenciales por pasarela.
- QR configurable para transferencia.

### Flujo
- `/precios` → `/registro?plan=...` → trial Pro.
- En Configuración → Plan y pagos: selects con todos los planes pagables.
- Checkout por pasarela habilitada (admin controla cuáles están activos).
- Webhooks: `/api/webhooks/{stripe,mercadopago,paypal}`.
- Confirmación al volver de Stripe (`/api/pagos/confirmar`) para activar el plan aunque el webhook tarde.

### Admin
- Pestaña Pagos: pagos pendientes/en revisión, aprobar/rechazar transferencias.
- Configuración de pasarelas: claves secretas, webhook secrets, modo PayPal, datos bancarios + QR.
- Interruptores de habilitar/deshabilitar cada medio.

---

## 6. Panel de administración (`/admin`, solo super-admin)

Pestañas: **General, Usuarios, Pagos, Páginas, Marketing, Soporte, Sistema**.

### General
- Dashboard SaaS: empresas, por plan/estado, MRR/ARR, usuarios, productos, ventas, pagos pendientes, storage total, conversión, tráfico, empresas por mes.
- Gestión de empresas (listar, bloquear, ver detalles).

### Usuarios
- Listar todos los usuarios de la plataforma.
- Crear otro super-admin.
- Bloquear/desbloquear (con motivo) + ban en Supabase Auth.
- Resetear contraseña, toggle super-admin.
- Detalle: empresa, uso (productos, movimientos, ventas, usuarios, archivos, storage MB), última actividad de bitácora, historial de bloqueos.
- Filtros por texto, empresa, rol, estado.
- Exportar a Excel.

### Pagos
- Pagos pendientes y en revisión.
- Configuración de pasarelas y transferencia.

### Páginas
- Crear/editar/eliminar páginas de landing y blog.
- Editor de HTML puro con vista previa en vivo.
- Marcador `{{REGISTRO}}` para insertar el formulario de registro.
- Publicación/despublicación.
- Primera landing: "Olvídate de Excel para llevar tus inventarios".

### Marketing
- Sub-pestañas: Resumen, Campañas, Tráfico, Correo, Bajas, Freemium, Pixeles.
- **Campañas**: CRUD, UTM, landing URL, presupuesto, estado.
- **Enlace de seguimiento**: `/api/click/{codigo}` (registra click, redirige con UTM).
- **Pixel de apertura de correo**: `/api/pixel/{token}.gif` (1x1).
- **Honeypot**: enlace oculto para detectar validadores de correo; marca eventos como bot.
- **Bajas**: `/baja` con confirmación (evita scanners), listado y CSV para emparejar.
- **Métricas**: visitas, visitantes únicos, registros, demos, aperturas, clicks, bajas, tasa de registro.
- **Trafico reciente** y **Aperturas/clicks de correo** con paginación.
- **Freemium**: usuarios por probabilidad de conversión, score.
- **Pixeles**: configurar GA4, GTM y código custom en head/body.

### Soporte
- Tickets de soporte (crear, responder).
- Solicitudes de integración de facturación electrónica.

### Sistema
- Feature flags.
- Claves de administrador.
- Giro del negocio.
- Storage por empresa (ranking + limpieza de archivos huérfanos).
- Uso y adopción.

---

## 7. Marketing y pixeles

### Tablas
- `pixeles`: nombre, plataforma, pixel_id, código, activo, global.
- `conversion_scores`: scoring freemium por empresa.

### Configuración (super-admin)
- `/admin → Marketing → Pixeles`: Google Analytics 4 (Measurement ID), Google Tag Manager (Container ID), código personalizado en `<head>`, después de `<body>` y antes de `</body>`.
- El código se inyecta en el HTML inicial del sitio (server-side, layout dinámico).

### Análisis (super-admin)
- `/admin → Marketing`: usuarios freemium con probabilidad de conversión (scoring 0-100), empresas con alta probabilidad de upgrade, KPIs.
- El rastreo de campañas, tráfico, conversiones y bajas se lleva con herramientas externas (Google Analytics, Tag Manager, etc.), no en la base de datos del sistema.

### SEO / IA
- Home con metadatos completos, keywords, canonical, Open Graph, Twitter Card.
- JSON-LD: Organization, WebSite, SoftwareApplication, FAQPage.
- Secciones semánticas, FAQ, planes.
- `robots.txt` permite rastreadores de IA (GPTBot, ClaudeBot, PerplexityBot, etc.).
- `sitemap.xml` (solo páginas públicas + campañas publicadas).
- `llms.txt` y `ai.txt`.
- Dominio propio `https://inventser.online`.

---

## 8. Soporte y conocimiento

### Tickets (`/api/soporte`)
- Crear ticket (asunto, categoría, mensaje).
- Listar y responder (admin).
- Solicitudes de integración de facturación.

### Base de conocimiento (`/ayuda`)
- ~30 artículos en `src/lib/baseConocimiento.js`.
- Búsqueda en vivo, filtros por categoría, acordeón.
- Cubre: inventario, movimientos, proveedores, clientes, ventas, compras, CxC, CxP, caja, reportes, traslados, contabilidad, usuarios, configuración, admin, asistente.

---

## 9. Landing y pricing

### Landing (`/`)
- Hero con CTA, demo, beneficios, para quién, cómo funciona, planes, FAQ, sistemas personalizados, footer con contacto.
- SEO optimizado (metadatos, JSON-LD, FAQ, semantic HTML).

### Pricing (`/precios`)
- Planes con precios y features.
- Enlace a registro por plan.

### Registro (`/registro`)
- Formulario con país/moneda, giro, campos personalizados.
- Trial Pro 14 días.
- Tracking de registro y conversión.
- Modo embed para landings.

---

## 10. Asistente (NLU)

- Motor local en `src/services/nlu.js` (CommonJS).
- Reglas ordenadas + capa difusa con sinónimos, similitud y tolerancia.
- ~40 intenciones.
- Handlers en `src/app/api/asistente/route.js`.
- Acciones con confirmación en `src/app/api/asistente/ejecutar/route.js`.
- Alias aprendidos por usuario (`asistente_alias`).
- Si no está seguro, muestra sugerencias como botones.

---

## 11. Sesiones y seguridad

- Access token de Supabase (~1 h) renovado automáticamente con refresh token.
- Cookie de 1 año, renovada en cada refresh.
- Middleware solo exige presencia de cookie (validación final en la API).
- `/admin` renueva cada 30 min.
- Bloqueo/desbloqueo de usuarios con ban en Supabase Auth y verificación de `activo`.
- Sesión dura hasta logout, cambio de cuenta o bloqueo.

---

## 12. Almacenamiento

- Bucket `archivos` en Supabase Storage.
- `src/lib/storage.js`: subir, borrar, firmar URL, uso por empresa, uso total, listar todos, borrar huérfanos.
- Endpoints: `/api/archivos`, logo upload, adjuntos de producto.
- Migraciones: `026_storage_archivos.sql`, `027_logo_empresa.sql`, `028_producto_adjuntos.sql`.

---

## 13. Migraciones (001–042)

Listado de migraciones en orden:
- 001–012: esquema base, admin, giros, demo, almacén, contabilidad, demo ampliado, país/moneda.
- 013: planes freemium.
- 014: comercial (clientes, ventas, compras, CxC, CxP).
- 015: multi-almacén.
- 016: facturación IVA.
- 017: caja/arqueo.
- 018: notificaciones.
- 019: email config.
- 020: WhatsApp.
- 021: caja detallado.
- 022: facturación electrónica.
- 023: traslados.
- 024: alertas config.
- 025: asistente almacén.
- 026: storage archivos.
- 027: logo empresa.
- 028: producto adjuntos.
- 029: feature flags.
- 030: marketing y tracking.
- 031: soporte tickets.
- 032: config pagos.
- 033: transferencia QR.
- 034: historial de bloqueos.
- 035: interruptores de métodos de pago.
- 036: páginas públicas (landing/blog).
- 037: primera landing "Olvídate de Excel".
- 038: tracking de campañas y pixel.
- 039: honeypot y bots.
- 040: bajas de correo.
- 041: avisos dirigidos.
- 042: configuración global del sitio (píxeles).

---

## 14. Gaps conocidos / oportunidades

1. **Multi-tab**: si se abren `/panel` y `/admin` en dos pestañas, la rotación del refresh token puede causar logouts. Se puede desactivar la rotación en Supabase o usar BroadcastChannel.
2. **`/api/asistente/aprender`** era un alias roto; se corrigió a `/api/asistente/alias`.
3. **Reportes de traslados entre bodegas** y rendimiento por almacén se calculan en memoria; con muchos datos podría optimizarse con RPCs.
4. **Sesión "permanente"** depende de la configuración de Supabase (Refresh token expiration).
5. **Favicon/logo** del landing ya está, pero el logo del panel (renderer) usa `public/logo.png` con fondo blanco; podría tener una versión transparente.
6. **Exportación a Excel** del listado de usuarios ya existe; se podría extender a otras tablas.
7. **A/B testing** fue solicitado pero no se implementó como tal; los feature flags permiten variantes parciales.
8. **Auditoría de bloqueos** (quién/bloqueó) ya existe; podría agregarse exportación.
9. **Chat en tiempo real** (mensajería entre usuarios) no existe.
10. **App móvil / PWA** no está implementada (el sistema es responsive web).
11. **Modo offline** no existe.
12. **Multi-idioma** no existe (todo en español).
13. **Integraciones contables externas** (QuickBooks, Xero) no existen.
14. **API pública / webhooks de salida** parcial (solo webhook de productos).
15. **Backup automático** no implementado.
16. **White-label** (logo propio por empresa) solo parcial (logo upload sí existe).
17. **Suscripciones recurrentes** (renovación automática con Stripe subscriptions) no implementado; se usa pago único por ciclo.
18. **Portal de cliente** para ver su CxC no existe.
19. **QR de producto** para inventario móvil no existe.
20. **Notificaciones push** (web push) no existen.

---

## 15. Ideas para hacer el sistema más atractivo

1. **Onboarding guiado** con pasos (crear primer producto, primera venta, invitar usuario) y barra de progreso.
2. **Dashboard con gráficos** (ventas por día, top productos, stock por categoría) en lugar de solo tablas.
3. **Modo oscuro**.
4. **PWA instalable** con icono y splash screen.
5. **Atajos de teclado** (Ctrl+K para búsqueda global).
6. **Búsqueda global** (Cmd+K) que busca productos, clientes, ventas, etc.
7. **Notificaciones push** del navegador.
8. **Exportación a PDF** de reportes (además de Excel).
9. **Integración con WhatsApp Business** para enviar facturas y recordatorios de CxC.
10. **Plantillas de correo** personalizables para alertas.
11. **Multi-sucursal** con dashboard comparativo.
12. **Importación desde otros sistemas** (QuickBooks, Alegra, etc.).
13. **Catálogo público** (storefront) para que los clientes vean productos y stock.
14. **POS en pantalla completa** con scanner de código de barras.
15. **Etiquetas de producto** imprimibles con código de barras/QR.
16. **Inventario cíclico** (conteos físicos periódicos).
17. **Lotes y series** (para farmacia/construcción).
18. **Caducidades** (alertas de vencimiento).
19. **Costo estándar vs promedio** (opción de valuación).
20. **Presupuestos / cotizaciones** antes de la venta.
21. **Compras con órdenes de compra** y recepción parcial.
22. **Devoluciones** y notas de crédito.
23. **Descuentos y promociones** por producto/cliente.
24. **Programa de fidelidad**.
25. **Integración con e-commerce** (Shopify, WooCommerce).
26. **Dashboard móvil** optimizado.
27. **Chatbot en WhatsApp** para consultas de stock.
28. **A/B testing** (solicitado) en landings y emails.
29. **Automatizaciones**: reglas "si stock < X, enviar correo".
30. **API pública** para integraciones.

---

## 16. Credenciales y acceso

- **Super-admin:** `ldgframe@gmail.com` / `Sofia22077#` (creado por SQL). URL: `/admin`.
- **Demo:** `demo@abarrotes.com` / `demo123456` (admin de empresa, no super-admin).
- **URL de producción:** https://inventser.online
- **Webhooks:** `/api/webhooks/stripe`, `/api/webhooks/mercadopago`, `/api/webhooks/paypal`.
- **Sin `.env` local**; las claves se configuran en `/admin` o en Vercel.

---

## 17. Comandos útiles

```bash
npm run build   # compilar
npm start       # servir
npm run dev     # desarrollo
```

Migraciones: aplicar en Supabase → SQL Editor en orden (001–042), idempotentes.

---

*Documento generado a partir del estado del repositorio en el commit `a87481a`.*

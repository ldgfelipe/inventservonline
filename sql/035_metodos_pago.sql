-- ============================================================
--  Migracion 035: habilitar/deshabilitar metodos de pago
--
--  El super-admin puede activar o desactivar cada metodo desde
--  /admin -> Pagos. Si un metodo esta en false, los usuarios no
--  pueden iniciar pagos por esa via (se valida en el servidor y
--  se oculta en el panel).
--
--  Ejecutar DESPUES de 032_config_pagos.sql.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

alter table if exists public.configuracion_pagos
  add column if not exists stripe_activo        boolean not null default true,
  add column if not exists mercadopago_activo   boolean not null default true,
  add column if not exists paypal_activo        boolean not null default true,
  add column if not exists transferencia_activa boolean not null default true;

comment on column public.configuracion_pagos.stripe_activo        is 'Permite pagar con Stripe. Migracion 035.';
comment on column public.configuracion_pagos.mercadopago_activo   is 'Permite pagar con Mercado Pago. Migracion 035.';
comment on column public.configuracion_pagos.paypal_activo        is 'Permite pagar con PayPal. Migracion 035.';
comment on column public.configuracion_pagos.transferencia_activa is 'Permite registrar pagos por transferencia bancaria. Migracion 035.';

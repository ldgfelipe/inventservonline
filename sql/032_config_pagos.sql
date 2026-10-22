-- ============================================================
--  Migracion 032: configuracion de pagos del SaaS
--
--  Ejecutar DESPUES de 031_soporte_tickets.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
--
--  Guarda las credenciales de las pasarelas (Stripe, Mercado Pago,
--  PayPal) y los datos de transferencia bancaria. Es una fila global
--  (una sola configuracion para toda la plataforma).
-- ============================================================

create table if not exists public.configuracion_pagos (
  id                        integer primary key default 1 check (id = 1),
  stripe_secret_key         text,
  stripe_webhook_secret     text,
  mercadopago_access_token  text,
  mercadopago_webhook_secret text,
  paypal_client_id          text,
  paypal_secret             text,
  paypal_webhook_id         text,
  paypal_mode               text not null default 'sandbox' check (paypal_mode in ('sandbox','live')),
  transferencia_banco       text,
  transferencia_cuenta      text,
  transferencia_titular     text,
  transferencia_rif         text,
  transferencia_instrucciones text,
  updated_at                timestamptz not null default now()
);

-- Fila unica
insert into public.configuracion_pagos (id) values (1)
on conflict (id) do nothing;

-- RLS: solo super-admin (el servidor usa service_role y salta RLS)
alter table public.configuracion_pagos enable row level security;

drop policy if exists "superadmin lee config pagos" on public.configuracion_pagos;
create policy "superadmin lee config pagos" on public.configuracion_pagos
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "superadmin escribe config pagos" on public.configuracion_pagos;
create policy "superadmin escribe config pagos" on public.configuracion_pagos
  for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

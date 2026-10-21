-- ============================================================
--  Migracion 030: marketing, campanas y tracking
--
--  Ejecutar DESPUES de 029_feature_flags.sql en el SQL Editor.
--  Idempotente: se puede ejecutar varias veces sin romper nada.
--
--  Cubre:
--   - Campanas (CCP, organico, mailing)
--   - Tracking de trafico (UTM, fuente, medio)
--   - Conversiones (registro, valor, atribucion)
--   - Pixeles de tracking (Facebook, Google, etc.)
--   - Landing pages para campanas
--   - Analisis de conversion freemium -> pago
-- ============================================================

-- ------------------------------------------------------------
--  1. Campanas de marketing
-- ------------------------------------------------------------
create table if not exists public.campanas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  tipo          text not null default 'ccp'
                  check (tipo in ('ccp','organico','mailing','referido','otro')),
  canal         text,               -- facebook, google, email, etc.
  descripcion   text,
  presupuesto   numeric(14,2) default 0,
  moneda        text default 'USD',
  fecha_inicio  date,
  fecha_fin     date,
  estado        text not null default 'activa'
                  check (estado in ('borrador','activa','pausada','finalizada')),
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  landing_url   text,
  pixel_id      uuid,                -- referencia a pixeles
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_campanas_estado on public.campanas(estado);
create index if not exists idx_campanas_tipo on public.campanas(tipo);

-- ------------------------------------------------------------
--  2. Trafico (visitas y registros atribuidos)
-- ------------------------------------------------------------
create table if not exists public.trafico (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references public.empresas(id) on delete set null,
  campana_id    uuid references public.campanas(id) on delete set null,
  fuente        text,               -- organic, facebook, google, email, direct
  medio         text,               -- cpc, organic, email, referral
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  pagina        text,               -- landing page URL
  ip            text,
  user_agent    text,
  referer       text,
  evento        text not null default 'visita'
                  check (evento in ('visita','registro','conversion','pago')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_trafico_campana on public.trafico(campana_id, created_at desc);
create index if not exists idx_trafico_empresa on public.trafico(empresa_id);
create index if not exists idx_trafico_evento on public.trafico(evento, created_at desc);
create index if not exists idx_trafico_fuente on public.trafico(fuente, created_at desc);

-- ------------------------------------------------------------
--  3. Conversiones
-- ------------------------------------------------------------
create table if not exists public.conversiones (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  campana_id    uuid references public.campanas(id) on delete set null,
  tipo          text not null default 'registro'
                  check (tipo in ('registro','activacion','pago','upgrade','churn')),
  valor         numeric(14,2) default 0,
  moneda        text default 'USD',
  plan          text,
  metodo_pago   text,
  notas         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_conv_campana on public.conversiones(campana_id, created_at desc);
create index if not exists idx_conv_empresa on public.conversiones(empresa_id, created_at desc);
create index if not exists idx_conv_tipo on public.conversiones(tipo, created_at desc);

-- ------------------------------------------------------------
--  4. Pixeles de tracking
-- ------------------------------------------------------------
create table if not exists public.pixeles (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  plataforma  text not null
                check (plataforma in ('facebook','google','tiktok','linkedin','twitter','custom')),
  pixel_id    text not null,
  codigo      text,                -- codigo completo del pixel (script)
  activo      boolean not null default true,
  global      boolean not null default true,  -- true = todas las landing pages
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
--  5. Landing pages
-- ------------------------------------------------------------
create table if not exists public.landing_pages (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  slug          text not null unique,
  titulo        text,
  descripcion   text,
  contenido     text,               -- HTML de la landing
  campana_id    uuid references public.campanas(id) on delete set null,
  pixeles       uuid[],             -- pixeles asociados
  publicada     boolean not null default false,
  visitas       integer not null default 0,
  conversiones  integer not null default 0,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_lp_slug on public.landing_pages(slug);
create index if not exists idx_lp_campana on public.landing_pages(campana_id);

-- ------------------------------------------------------------
--  6. Analisis de conversion freemium
-- ------------------------------------------------------------
create table if not exists public.conversion_scores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null unique references public.empresas(id) on delete cascade,
  score           integer not null default 0 check (score between 0 and 100),
  factores        jsonb default '{}'::jsonb,
  ultima_calculo  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
--  7. RLS
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['campanas','trafico','conversiones','pixeles','landing_pages','conversion_scores'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Campanas, pixeles, landing_pages: super-admin gestiona, todos leen (publico para landing)
drop policy if exists "leer campanas" on public.campanas;
create policy "leer campanas" on public.campanas for select to authenticated using (true);
drop policy if exists "superadmin gestiona campanas" on public.campanas;
create policy "superadmin gestiona campanas" on public.campanas for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "leer pixeles" on public.pixeles;
create policy "leer pixeles" on public.pixeles for select to authenticated using (true);
drop policy if exists "superadmin gestiona pixeles" on public.pixeles;
create policy "superadmin gestiona pixeles" on public.pixeles for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

drop policy if exists "leer landing_pages" on public.landing_pages;
create policy "leer landing_pages" on public.landing_pages for select to authenticated using (true);
drop policy if exists "superadmin gestiona landing_pages" on public.landing_pages;
create policy "superadmin gestiona landing_pages" on public.landing_pages for all to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin))
  with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

-- Trafico: insertar publico (para tracking de visitas), leer super-admin
drop policy if exists "insertar trafico" on public.trafico;
create policy "insertar trafico" on public.trafico for insert to anon, authenticated with check (true);
drop policy if exists "superadmin lee trafico" on public.trafico;
create policy "superadmin lee trafico" on public.trafico for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

-- Conversiones: insertar autenticado, leer super-admin o propia empresa
drop policy if exists "insertar conversiones" on public.conversiones;
create policy "insertar conversiones" on public.conversiones for insert to authenticated with check (true);
drop policy if exists "leer conversiones" on public.conversiones;
create policy "leer conversiones" on public.conversiones for select to authenticated
  using (empresa_id = public.empresa_actual() or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

-- Conversion scores: super-admin
drop policy if exists "leer conversion_scores" on public.conversion_scores;
create policy "leer conversion_scores" on public.conversion_scores for select to authenticated
  using (empresa_id = public.empresa_actual() or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));
drop policy if exists "insertar conversion_scores" on public.conversion_scores;
create policy "insertar conversion_scores" on public.conversion_scores for insert to authenticated with check (true);
drop policy if exists "actualizar conversion_scores" on public.conversion_scores;
create policy "actualizar conversion_scores" on public.conversion_scores for update to authenticated
  using (empresa_id = public.empresa_actual() or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.super_admin));

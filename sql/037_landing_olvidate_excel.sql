-- ============================================================
--  Migracion 037: primera pagina de aterrizaje
--
--  "Olvidate de Excel para llevar tus inventarios": pagina de un
--  solo paso (one-way) con el logo, el titular y el formulario de
--  registro. El marcador {{REGISTRO}} se sustituye por el
--  formulario real al renderizar /p/olvidate-de-excel.
--
--  Idempotente: si el slug ya existe, no hace nada.
-- ============================================================

insert into public.paginas (slug, titulo, tipo, html, publicado)
select 'olvidate-de-excel',
       'Olvídate de Excel para llevar tus inventarios',
       'landing',
       $$<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <a href="/" style="display:block;margin-bottom:28px;">
    <img src="/logo.png" alt="inventserOnline" style="height:60px;width:auto;display:block;">
  </a>
  <h1 style="font-size:36px;margin:0 0 12px;text-align:center;line-height:1.15;max-width:720px;">Olvídate de Excel para llevar tus inventarios</h1>
  <p style="font-size:17px;opacity:0.85;max-width:560px;text-align:center;margin:0 0 32px;line-height:1.6;">
    Controla entradas, salidas y stock en tiempo real. Sin hojas de cálculo, sin errores, sin perder tiempo.
  </p>
  <div style="width:100%;max-width:460px;background:#fff;border-radius:16px;padding:12px;box-shadow:0 12px 48px rgba(0,0,0,0.35);">
    {{REGISTRO}}
  </div>
  <p style="font-size:12px;opacity:0.55;margin-top:24px;text-align:center;">
    inventserOnline · Sistema de Inventarios Online
  </p>
</div>$$,
       true
where not exists (select 1 from public.paginas where slug = 'olvidate-de-excel');

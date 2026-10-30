with open('src/app/page.js','r',encoding='utf-8') as f:
    content = f.read()
# Import
content = content.replace("import DemoButton from '@/components/DemoButton';", "import DemoButton from '@/components/DemoButton';\nimport { t, detectLocale } from '@/lib/i18n';")
# Leer cookie
content = content.replace("export default function Landing() {", "export default function Landing() {\n  const lang = detectLocale(typeof document !== 'undefined' ? document.cookie.split(';').find(c=>c.trim().startsWith('inventser_lang='))?.split('=')[1] : 'es');")
# Reemplazar algunos literales principales (simplificado)
content = content.replace("Sistema de inventarios online para controlar tu stock sin Excel", "{t('home_hero_title', lang)}")
content = content.replace("Controla entradas, salidas, ventas, compras y almacenes desde cualquier equipo.", "{t('home_hero_subtitle', lang)}")
content = content.replace("Empieza gratis", "{t('home_hero_cta_gratis', lang)}")
content = content.replace("Ver planes y precios", "{t('home_hero_cta_planos', lang)}")
with open('src/app/page.js','w',encoding='utf-8') as f:
    f.write(content)

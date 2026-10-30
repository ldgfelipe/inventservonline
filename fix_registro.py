with open('src/app/registro/page.js','r',encoding='utf-8') as f:
    content = f.read()
content = content.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { t, detectLocale } from '@/lib/i18n';")
# Reemplazar literales principales (no todos por simplicidad)
content = content.replace("Crear cuenta gratis", "{t('registro_title','es')}")
content = content.replace("Nombre de la empresa o persona", "{t('registro_campo_empresa','es')}")
content = content.replace("Giro del negocio", "{t('registro_campo_giro','es')}")
content = content.replace("País", "{t('registro_pais','es')}")
content = content.replace("Moneda", "{t('registro_moneda','es')}")
content = content.replace("Continuar", "{t('registro_continuar','es')}")
with open('src/app/registro/page.js','w',encoding='utf-8') as f:
    f.write(content)

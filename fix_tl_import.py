import os
for root, dirs, files in os.walk('src/app'):
    for f in files:
        if f.endswith('.js') or f.endswith('.jsx'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8') as file:
                c = file.read()
            if 'tl(' in c:
                # Agregar tl al import existente
                c = c.replace("import { t, detectLocale } from '@/lib/i18n';", "import { t, detectLocale, tl } from '@/lib/i18n';")
                c = c.replace("import { t } from '@/lib/i18n';", "import { t, tl } from '@/lib/i18n';")
                with open(p, 'w', encoding='utf-8') as file:
                    file.write(c)

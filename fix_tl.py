import os, re
for root, dirs, files in os.walk('src/app'):
    for name in files:
        if name.endswith('.js') or name.endswith('.jsx'):
            p = os.path.join(root, name)
            with open(p, 'r', encoding='utf-8') as f:
                c = f.read()
            # Reemplazar t('clave', lang) por tl('clave')
            new_c = re.sub(r"t\('([^']+)',\s*lang\)", r"tl('\1')", c)
            if new_c != c:
                with open(p, 'w', encoding='utf-8') as f:
                    f.write(new_c)

import os, re
with open('src/components/Landing.js','r',encoding='utf-8') as f:
    c = f.read()
# Reemplazar t('clave', lang) por 'clave' (texto fijo en español)
c = re.sub(r"t\('([^']+)',\s*lang\)", r"'\1'", c)
with open('src/components/Landing.js','w',encoding='utf-8') as f:
    f.write(c)

with open('src/lib/i18n.js','r',encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'const match = String(cookieValue)' in line:
        indent = '  '
        lines[i] = indent + "const str = String(cookieValue).trim();\n"
        lines.insert(i+1, indent + "if (str === 'es' || str === 'en') return str;\n")
        lines[i+2] = indent + "const match = str.match(/inventser_lang=([^;]+)/);\n"
        # Eliminar la línea anterior con match antiguo (ahora está en i+3?)
        # Pero como reemplazamos la línea de match, no hay duplicado
        break
with open('src/lib/i18n.js','w',encoding='utf-8') as f:
    f.writelines(lines)

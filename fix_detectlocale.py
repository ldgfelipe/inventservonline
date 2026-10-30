with open('src/lib/i18n.js','r',encoding='utf-8') as f:
    lines = f.read()
old = "  const match = String(cookieValue).match(/inventser_lang=([^;]+)/);"
new = "  const str = String(cookieValue).trim();\n  if (str === 'es' || str === 'en') return str;\n  const match = str.match(/inventser_lang=([^;]+)/);"
lines = lines.replace(old, new)
with open('src/lib/i18n.js','w',encoding='utf-8') as f:
    f.write(lines)

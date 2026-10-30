with open('src/app/registro/page.js','r',encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    "function FormularioRegistro() {",
    "function FormularioRegistro() {\n  const lang = detectLocale(typeof document !== 'undefined' ? (document.cookie.split(';').find(c=>c.trim().startsWith('inventser_lang='))?.split('=')[1] || 'es') : 'es');")
content = content.replace(", 'es')", ", lang)")
with open('src/app/registro/page.js','w',encoding='utf-8') as f:
    f.write(content)

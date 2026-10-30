with open('src/app/entrar/page.js','r',encoding='utf-8') as f:
    content = f.read()
# Agregar lectura de lang dentro de FormularioEntrar
content = content.replace(
    "function FormularioEntrar() {\n  const router = useRouter();",
    "function FormularioEntrar() {\n  const lang = detectLocale(typeof document !== 'undefined' ? (document.cookie.split(';').find(c=>c.trim().startsWith('inventser_lang='))?.split('=')[1] || 'es') : 'es');\n  const router = useRouter();")
# Reemplazar todos los t(...,'es') por t(...,lang)
content = content.replace(", 'es')", ", lang)")
with open('src/app/entrar/page.js','w',encoding='utf-8') as f:
    f.write(content)

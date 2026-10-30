with open('src/app/admin/page.js','r',encoding='utf-8') as f:
    content = f.read()
# Agregar lang dentro de la funcao Admin (usState useEffect)
content = content.replace(
    "export default function Admin() {\n  const [usuario, setUsuario] = useState(null);",
    "export default function Admin() {\n  const lang = detectLocale(typeof document !== 'undefined' ? (document.cookie.split(';').find(c=>c.trim().startsWith('inventser_lang='))?.split('=')[1] || 'es') : 'es');\n  const [usuario, setUsuario] = useState(null);")
# Reemplazar todos t(...,'es') por t(...,lang)  -- cuidado: no reemplazamos 'en'
content = content.replace("'es')", "lang)")
with open('src/app/admin/page.js','w',encoding='utf-8') as f:
    f.write(content)

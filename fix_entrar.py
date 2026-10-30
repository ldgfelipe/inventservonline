with open('src/app/entrar/page.js','r',encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    "import Link from 'next/link';",
    "import Link from 'next/link';\nimport { t, detectLocale } from '@/lib/i18n';")
content = content.replace("if (params.get('nuevo') === '1') setNota('Cuenta creada. Entra con tu email y contrasena.');", "if (params.get('nuevo') === '1') setNota(t('login_nota_nueva', 'es'));")
content = content.replace("if (params.get('expiro') === '1') setNota('Tu sesion expiro. Entra de nuevo.');", "if (params.get('expiro') === '1') setNota(t('login_nota_expirada', 'es'));")
content = content.replace("if (params.get('salio') === '1') setNota('Sesion cerrada.');", "if (params.get('salio') === '1') setNota(t('login_nota_salio', 'es'));")
content = content.replace("throw new Error(j.error || 'No se pudo iniciar sesion');", "throw new Error(j.error || t('login_error_generico', 'es'));")
content = content.replace("<h1>Entrar</h1>", "<h1>{t('entrar_title','es')}</h1>")
content = content.replace("<p className=\"sub\">Accede a tu inventario desde cualquier equipo.</p>", "<p className=\"sub\">{t('login_subtitle','es')}</p>")
content = content.replace("<label>Email</label>", "<label>{t('login_email','es')}</label>")
content = content.replace("<label>Contrasena</label>", "<label>{t('login_password','es')}</label>")
content = content.replace("Recordar mi email", "{t('login_recordar','es')}")
content = content.replace("{cargando ? 'Entrando...' : 'Entrar'}", "{cargando ? t('login_entrando','es') : t('login_entrar','es')}")
content = content.replace("No tienes cuenta? <Link href=\"/registro\">Crear una gratis</Link>", "{t('login_nueva_cuenta','es')} <Link href=\"/registro\">{t('registro_continuar','es')}</Link>")
with open('src/app/entrar/page.js','w',encoding='utf-8') as f:
    f.write(content)

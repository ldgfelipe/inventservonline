with open('src/app/registro/page.js','r',encoding='utf-8') as f:
    content = f.read()
content = content.replace("Crear cuenta y entrar", "{t('registro_continuar', lang)}")
content = content.replace("A que se dedica tu negocio *", "{t('registro_campo_giro', lang)}")
content = content.replace("Se usara para mostrar los montos. Podras cambiarla luego en Configuracion.", "{t('registro_ayuda_moneda', lang)}")
with open('src/app/registro/page.js','w',encoding='utf-8') as f:
    f.write(content)

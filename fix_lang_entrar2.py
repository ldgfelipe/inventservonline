with open('src/app/entrar/page.js','r',encoding='utf-8') as f:
    content = f.read()
content = content.replace("'es')", "lang)")
with open('src/app/entrar/page.js','w',encoding='utf-8') as f:
    f.write(content)

with open('src/components/Landing.js','r',encoding='utf-8') as f:
    c = f.read()
c = c.replace("'https://inventser.online'" + " + ", "'https://inventser.online'" + " + ")  # NO, esto no sirve
# Reemplazar变量名为 BASE 直接换成 const URL = 'https://inventser.online'; y remplazar BASE => URL
c = c.replace("const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://inventser.online').replace('/+$/', '');", "")
c = c.replace('BASE', "'https://inventser.online'")
with open('src/components/Landing.js','w',encoding='utf-8') as f:
    f.write(c)

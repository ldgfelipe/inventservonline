import re
with open('src/components/Landing.js', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r"tl\('([^']+)'\)", r"t('\1', lang)", c)
with open('src/components/Landing.js', 'w', encoding='utf-8') as f:
    f.write(c)

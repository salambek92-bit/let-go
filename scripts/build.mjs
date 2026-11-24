import fs from 'node:fs';
fs.rmSync('dist', { recursive: true, force: true }); fs.mkdirSync('dist');
for (const f of fs.readdirSync('src')) fs.copyFileSync('src/' + f, 'dist/' + f);
fs.writeFileSync('dist/.nojekyll', '');
console.log('built dist/:', fs.readdirSync('dist').join(', '));

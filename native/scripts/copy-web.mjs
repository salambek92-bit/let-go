// Copies the game (../src) into www so it is bundled inside the app and runs fully offline.
import fs from 'node:fs';
fs.rmSync('www', { recursive: true, force: true }); fs.mkdirSync('www');
for (const f of fs.readdirSync('../src')) if (!f.startsWith('icon-render') && !['privacy.html','support.html'].includes(f)) fs.copyFileSync('../src/' + f, 'www/' + f);
console.log('www:', fs.readdirSync('www').join(', '));

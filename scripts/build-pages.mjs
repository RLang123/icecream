import { copyFile, access } from 'node:fs/promises';

await access('dist/index.html');
await copyFile('worker/index.js', 'dist/_worker.js');
await copyFile('worker/menu-availability.js', 'dist/menu-availability.js');
console.log('Cloudflare Pages Worker copied to dist/_worker.js');

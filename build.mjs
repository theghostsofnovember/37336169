// Assembles src/ into a single self-contained index.html (Three.js r128 still loads from CDN).
import {readFileSync, writeFileSync} from 'node:fs';
const tpl = readFileSync('src/template.html', 'utf8');
const data = readFileSync('src/head-data.js', 'utf8').trim();
const app = readFileSync('src/app.js', 'utf8');
// function replacers: the sources contain `$'` sequences that string replacements would expand
const out = tpl.replace('/*HEAD_DATA*/', () => data).replace('/*APP*/', () => app);
writeFileSync('index.html', out);
console.log('index.html', (out.length / 1024).toFixed(1) + ' KB');

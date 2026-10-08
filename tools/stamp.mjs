// Adds ?v=<hash of the site's code> to every script and stylesheet address, so
// browsers fetch fresh copies after each change instead of mixing old and new
// files. Run it before committing (the GitHub Pages deploy runs it too):
//   node tools/stamp.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const scripts = walk(join(root, 'js')).filter((f) => f.endsWith('.js')).sort();
const style = join(root, 'css', 'style.css');

// the version ignores existing stamps, so stamping twice changes nothing
const unstamp = (s) => s.replace(/\?v=[0-9a-f]+(?=['"])/g, '');
const hash = createHash('sha1');
for (const f of [...scripts, style]) hash.update(unstamp(readFileSync(f, 'utf8')));
const v = hash.digest('hex').slice(0, 10);

// every relative import, static or dynamic, gets the same stamp
const IMPORT = /((?:\bfrom\s*|\bimport\s*\(\s*)['"])(\.{1,2}\/[^'"?]+\.js)(?:\?v=[0-9a-f]+)?(['"])/g;
let changed = 0;
for (const f of scripts) {
  const s = readFileSync(f, 'utf8');
  const t = s.replace(IMPORT, `$1$2?v=${v}$3`);
  if (t !== s) { writeFileSync(f, t); changed++; }
}
const html = join(root, 'index.html');
const h = readFileSync(html, 'utf8');
const h2 = h.replace(/((?:href="css\/style\.css)|(?:src="js\/main\.js))(?:\?v=[0-9a-f]+)?"/g, `$1?v=${v}"`);
if (h2 !== h) { writeFileSync(html, h2); changed++; }
console.log(`stamped v=${v} (${changed} files updated)`);

// Copies the Vite build (dist/) to the repo root as the GitHub Pages site.
// app.js / app.css get a ?v=<content hash> so phones never keep an old copy.
// Usage (from source/): npm run build && npm run publish
import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const root = new URL('../../', import.meta.url).pathname;
const assets = readdirSync(join(dist, 'assets'));
const pick = (ext) => {
  const f = assets.find(a => a.endsWith(ext));
  if (!f) throw new Error(`No ${ext} in dist/assets — run npm run build first`);
  return join(dist, 'assets', f);
};
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);

const js = pick('.js');
const css = pick('.css');
copyFileSync(js, join(root, 'app.js'));
copyFileSync(css, join(root, 'app.css'));
for (const f of ['sw.js', 'manifest.webmanifest', 'favicon.svg', 'icons.svg', 'icon-192.png', 'icon-512.png']) {
  copyFileSync(join(dist, f), join(root, f));
}

const html = readFileSync(join(dist, 'index.html'), 'utf8')
  .replace(/\s*<script type="module" crossorigin src="[^"]+"><\/script>/, '')
  .replace(/\s*<link rel="stylesheet" crossorigin href="[^"]+">/, '')
  .replace('</body>', `  <link rel="stylesheet" href="./app.css?v=${hash(css)}"><script type="module" src="./app.js?v=${hash(js)}"></script>\n  </body>`);
writeFileSync(join(root, 'index.html'), html);
writeFileSync(join(root, '404.html'), html);
console.log(`Published: app.js?v=${hash(js)} app.css?v=${hash(css)}`);

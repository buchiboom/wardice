// Assemble the Capacitor web dir (www/) from the source files that live at the
// repo root (kept at root so GitHub Pages can serve them directly).
import { cp, rm, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const www = resolve(root, 'www');

const FILES = ['index.html', 'app.js', 'styles.css', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['icons', 'sounds'];

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

for (const f of FILES) {
  await cp(resolve(root, f), resolve(www, f));
}
for (const d of DIRS) {
  await cp(resolve(root, d), resolve(www, d), { recursive: true });
}

console.log(`copy-web: wrote www/ (${FILES.length} files + ${DIRS.join(', ')})`);

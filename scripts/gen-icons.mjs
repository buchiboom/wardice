// Generate all app icons from a single square source image.
//   node scripts/gen-icons.mjs [sourcePath]
// Produces: PWA icons (192/512/1024) and Android launcher icons
// (legacy ic_launcher + round + adaptive foreground) across all densities.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, process.argv[2] || 'assets/icon-source.png');
const BG = '#0d0f12';                 // dark board tint, behind any transparency

const square = (size) => sharp(SRC).resize(size, size, { fit: 'cover' }).flatten({ background: BG });

// circular mask for the round launcher icon
const circle = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);

async function png(size, outPath, { round = false } = {}) {
  await mkdir(dirname(outPath), { recursive: true });
  let img = square(size);
  if (round) img = img.composite([{ input: circle(size), blend: 'dest-in' }]);
  await img.png().toFile(outPath);
}

// ---- PWA / web icons (only these ship in www/ to keep the bundle small) ----
await png(192, resolve(root, 'icons/icon-192.png'));
await png(512, resolve(root, 'icons/icon-512.png'));

// ---- Android launcher icons ----
const res = resolve(root, 'android/app/src/main/res');
const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [d, s] of Object.entries(LAUNCHER)) {
  await png(s, resolve(res, `mipmap-${d}/ic_launcher.png`));
  await png(s, resolve(res, `mipmap-${d}/ic_launcher_round.png`), { round: true });
}
// adaptive foreground is full-bleed (the source already has the dark storm bg)
for (const [d, s] of Object.entries(FOREGROUND)) {
  await png(s, resolve(res, `mipmap-${d}/ic_launcher_foreground.png`));
}

console.log('gen-icons: wrote PWA icons + Android launcher icons from', SRC);

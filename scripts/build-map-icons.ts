// Derive the small map-pin icons in assets/map-icons/ from the full map-note art in
// assets/map-notes/. Needs ImageMagick 7 (`magick`) on PATH; run after changing map-note art:
//   npm run build:icons
// Foundry stretches a note texture to a square and the ink is thin, so each icon is trimmed to
// its ink, ringed with a parchment halo (readable over the dark forest zones) and centred on a
// square canvas.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'assets', 'map-notes');
const OUT = join(ROOT, 'assets', 'map-icons');
// Notes are 160 px on a map players zoom into closely, so the icons keep 3x headroom.
const SIZE = 512;
const INK = Math.round(SIZE * 0.875);
const HALO_RADIUS = Math.round(SIZE / 50);
const HALO = '#efe3c4';

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SOURCE).filter((f) => f.endsWith('.webp'));
for (const file of files) {
  execFileSync('magick', [
    join(SOURCE, file),
    '-bordercolor', 'none', '-border', '2', '-trim', '+repage',
    '-resize', `${INK}x${INK}`,
    '(', '+clone', '-alpha', 'extract', '-morphology', 'Dilate', `Disk:${HALO_RADIUS}`, '-blur', `0x${HALO_RADIUS / 3}`,
    '-background', HALO, '-alpha', 'shape', '-channel', 'A', '-evaluate', 'multiply', '0.9', '+channel', ')',
    '+swap', '-background', 'none', '-layers', 'merge', '+repage',
    '-gravity', 'center', '-extent', `${SIZE}x${SIZE}`,
    '-quality', '90',
    join(OUT, file),
  ]);
}
console.log(`map icons: ${files.length} → assets/map-icons`);

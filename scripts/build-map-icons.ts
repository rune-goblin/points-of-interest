// Derive the small map-pin icons in assets/map-icons/ from the full map-note art in
// assets/map-notes/. Needs ImageMagick 7 (`magick`) on PATH; run after changing map-note art:
//   npm run build:icons
// Foundry stretches a note texture to a square and the ink is thin, so each icon is trimmed to
// its ink, traced with a thin semi-transparent white line (readable over the dark forest zones)
// and centred on a square canvas.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'assets', 'map-notes');
const OUT = join(ROOT, 'assets', 'map-icons');
// Notes are 275 px (one region hex wide) on a map players zoom into closely, so the icons keep
// nearly 2x headroom.
const SIZE = 512;
const INK = Math.round(SIZE * 0.96);
// About 2 screen pixels at 275 px; the slight blur only anti-aliases the dilated edge.
const OUTLINE_RADIUS = 4;
const OUTLINE_OPACITY = 0.6;

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SOURCE).filter((f) => f.endsWith('.webp'));
for (const file of files) {
  execFileSync('magick', [
    join(SOURCE, file),
    '-bordercolor', 'none', '-border', '2', '-trim', '+repage',
    '-resize', `${INK}x${INK}`,
    '(', '+clone', '-alpha', 'extract', '-morphology', 'Dilate', `Disk:${OUTLINE_RADIUS}`, '-blur', '0x0.7',
    '-background', 'white', '-alpha', 'shape', '-channel', 'A', '-evaluate', 'multiply', `${OUTLINE_OPACITY}`, '+channel', ')',
    '+swap', '-background', 'none', '-layers', 'merge', '+repage',
    '-gravity', 'center', '-extent', `${SIZE}x${SIZE}`,
    '-quality', '90',
    join(OUT, file),
  ]);
}
console.log(`map icons: ${files.length} → assets/map-icons`);

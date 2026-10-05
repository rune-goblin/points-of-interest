// Draw the Adventure banner, assets/adventure-banner.webp: one white-ink map-note sketch laid on a
// generated dark parchment. Needs ImageMagick 7 (`magick`) on PATH; the banner is committed, not built:
//   npm run build:banner
// The parchment is generated rather than copied so the module owns every pixel of it.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const NOTES = join(ROOT, 'assets', 'map-notes', 'white-ink');
const OUT = join(ROOT, 'assets', 'adventure-banner.webp');
const NOTE = '07-';
// Foundry's importer shows the banner about 888 x 300 px, cropped to fill; this is twice that.
const WIDTH = 1776;
const HEIGHT = 600;
const SKETCH_HEIGHT = Math.round(HEIGHT * 0.8);
const PAPER = '#5a4630';
const EDGE = '#1a120a';

const note = readdirSync(NOTES).find((f) => f.startsWith(NOTE) && f.endsWith('.webp'));
if (!note) throw new Error(`no map note ${NOTE}* in ${NOTES}`);

const size = ['-size', `${WIDTH}x${HEIGHT}`];
const noise = (seed: number, blur: number) => [
  '(', ...size, '-seed', `${seed}`, 'plasma:fractal', '-colorspace', 'gray', '-blur', `0x${blur}`, '-auto-level', ')',
];

execFileSync('magick', [
  ...size, `xc:${PAPER}`,
  ...noise(11, 10),
  ...noise(29, 40),
  '(', ...size, 'xc:', '-fx', '1 - 0.55 * pow(hypot((i - w/2) / (w/2), (j - h/2) / (h/2)) / sqrt(2), 2.4)',
  '+level-colors', `${EDGE},white`, ')',
  '(', ...size, 'xc:gray50', '-seed', '3', '-attenuate', '2', '+noise', 'Gaussian', '-colorspace', 'gray',
  '-motion-blur', '0x12+8', '-blur', '0x0.5', '-auto-level', ')',
  // Paper colour × fine mottling × broad stains × the darkened edge × fibrous grain.
  '-fx', 'u * (0.84 + 0.16 * u[1]) * (0.86 + 0.14 * u[2]) * u[3] * (0.94 + 0.12 * (u[4] - 0.5))',
  '(', join(NOTES, note), '-trim', '+repage', '-resize', `x${SKETCH_HEIGHT}`, ')',
  '-gravity', 'center', '-compose', 'over', '-composite',
  '-quality', '88',
  OUT,
]);
console.log(`adventure banner: ${note} → assets/adventure-banner.webp`);

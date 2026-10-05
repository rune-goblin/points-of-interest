// Derive the map-pin icons in assets/map-icons/ from the white-ink redraws of the map-note art in
// assets/map-notes/white-ink/ (the same redraws head the journal's encounter pages). Needs ImageMagick 7
// (`magick`) on PATH; run after changing that art:
//   npm run build:icons
// Each icon darkens its whole region hex with a black scrim and sets the sketch on it, scaled as
// large as the hex allows. The white and grey ink stays as drawn; coloured accents (#10's horn,
// #18's serpent) keep their hue, lightened so they stand off the scrim.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'assets', 'map-notes', 'white-ink');
const OUT = join(ROOT, 'assets', 'map-icons');
// The note spans its pointy-top hex point to point (ICON_SIZE in src/map-notes.ts), so the hex
// fills the square canvas top to bottom and is √3/2 as wide. Foundry stretches a note texture to
// a square, so the canvas must stay square.
const SIZE = 512;
const HEX_WIDTH = (SIZE * Math.sqrt(3)) / 2;
const SCRIM_OPACITY = 0.25;
// The sketch stays inside a hex this fraction of the scrim's size, clear of its edge.
const INSET = 0.88;
const ALPHA_THRESHOLD = 64;
const ACCENT_LIGHTNESS = 0.62;
const ACCENT_SATURATION = 0.6;
// In HSL, u.g is saturation and u.b lightness.
const IS_GREY = 'u.g < 0.15';

const magick = (args: string[]): Buffer => execFileSync('magick', args, { maxBuffer: 1 << 28 });

const c = SIZE / 2;
const hexPolygon = [
  [c, 0],
  [c + HEX_WIDTH / 2, SIZE / 4],
  [c + HEX_WIDTH / 2, (SIZE * 3) / 4],
  [c, SIZE],
  [c - HEX_WIDTH / 2, (SIZE * 3) / 4],
  [c - HEX_WIDTH / 2, SIZE / 4],
]
  .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
  .join(' ');

// Flat-to-flat width of the smallest pointy-top hex, centred on the origin, that holds (x, y).
const hexWidthFor = (x: number, y: number): number => Math.max(2 * Math.abs(x), Math.sqrt(3) * Math.abs(y) + Math.abs(x));

interface Fit {
  crop: { w: number; h: number; x: number; y: number };
  // Ink-space point that lands on the hex centre, measured from the crop's top-left.
  centre: { x: number; y: number };
  width: number;
}

// Sketches are irregular, so the fit tests every inked pixel, and nudges the centre off the
// bounding box's middle when that lets the sketch grow.
function fit(file: string): Fit {
  const [w, h, x, y] = magick([file, '-format', '%@', 'info:']).toString().match(/\d+/g)!.map(Number);
  const alpha = magick([file, '-crop', `${w}x${h}+${x}+${y}`, '+repage', '-alpha', 'extract', '-depth', '8', 'gray:-']);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] < ALPHA_THRESHOLD) continue;
    xs.push(i % w);
    ys.push(Math.floor(i / w));
  }
  const widthAround = (cx: number, cy: number): number => {
    let max = 0;
    for (let i = 0; i < xs.length; i++) max = Math.max(max, hexWidthFor(xs[i] - cx, ys[i] - cy));
    return max;
  };
  let best = { x: w / 2, y: h / 2, width: widthAround(w / 2, h / 2) };
  const steps = 8;
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const cx = w / 2 + (i / steps) * 0.15 * w;
      const cy = h / 2 + (j / steps) * 0.15 * h;
      const width = widthAround(cx, cy);
      if (width < best.width) best = { x: cx, y: cy, width };
    }
  }
  return { crop: { w, h, x, y }, centre: { x: best.x, y: best.y }, width: best.width };
}

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SOURCE).filter((f) => f.endsWith('.webp'));
for (const file of files) {
  const source = join(SOURCE, file);
  const { crop, centre, width } = fit(source);
  const scale = (INSET * HEX_WIDTH) / width;
  const left = Math.round(c - centre.x * scale);
  const top = Math.round(c - centre.y * scale);
  magick([
    '-size', `${SIZE}x${SIZE}`, 'xc:none',
    '-fill', `rgba(0,0,0,${SCRIM_OPACITY})`, '-draw', `polygon ${hexPolygon}`,
    '(', source, '-crop', `${crop.w}x${crop.h}+${crop.x}+${crop.y}`, '+repage',
    '-resize', `${Math.round(crop.w * scale)}x${Math.round(crop.h * scale)}!`,
    '-colorspace', 'HSL',
    '-channel', 'B', '-fx', `${IS_GREY} ? u.b : max(u.b, ${ACCENT_LIGHTNESS})`,
    '-channel', 'G', '-fx', `${IS_GREY} ? u.g : min(u.g, ${ACCENT_SATURATION})`,
    '+channel', '-colorspace', 'sRGB', ')',
    '-geometry', `${left >= 0 ? '+' : ''}${left}${top >= 0 ? '+' : ''}${top}`, '-composite',
    '-quality', '90',
    join(OUT, file),
  ]);
}
console.log(`map icons: ${files.length} → assets/map-icons`);

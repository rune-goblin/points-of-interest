import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const manifestPath = join(root, 'docs/art/journal-illustrations.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const [number, role, source] = process.argv.slice(2);
const encounter = manifest.encounters.find((entry: { number: number }) => entry.number === Number(number));
const image = encounter?.images.find((entry: { role: string }) => entry.role === role);
if (!image || !source || !existsSync(source)) throw new Error('Usage: node scripts/export-journal-illustration.ts <encounter> <role> <source.png>');

const identify = (args: string[]): string => execFileSync('magick', [source, ...args, 'info:'], { encoding: 'utf8' }).trim();
if (identify(['-format', '%[opaque]']) !== 'False') throw new Error(`${number}/${role}: generated image needs alpha transparency`);
const [width, height] = identify(['-format', '%w %h']).split(' ').map(Number);
const bounds = identify(['-alpha', 'extract', '-threshold', '1%', '-format', '%@']).match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
if (!bounds || Number(bounds[1]) === 0 || Number(bounds[2]) === 0) throw new Error(`${number}/${role}: empty illustration`);
// Ignore faint stray pixels when fitting the cutout; retain the original alpha inside its bounds.
const x = Math.max(0, Number(bounds[3]) - 2);
const y = Math.max(0, Number(bounds[4]) - 2);
const w = Math.min(width, Number(bounds[3]) + Number(bounds[1]) + 2) - x;
const h = Math.min(height, Number(bounds[4]) + Number(bounds[2]) + 2) - y;
for (const file of [image.original, image.asset]) mkdirSync(dirname(join(root, file)), { recursive: true });
copyFileSync(source, join(root, image.original));
execFileSync('cwebp', ['-quiet', '-q', '88', '-alpha_q', '100', '-crop', String(x), String(y), String(w), String(h), '-resize', role === 'location' ? '1024' : '384', '0', source, '-o', join(root, image.asset)]);
image.source = source;
image.exportBounds = { x, y, width: w, height: h };
image.status = 'complete';
writeFileSync(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2) + '\n');
renameSync(`${manifestPath}.tmp`, manifestPath);
console.log(`${String(encounter.number).padStart(2, '0')}/${role}: ${image.asset}`);

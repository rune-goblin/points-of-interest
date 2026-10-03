// Generate the journal pack sources from docs/encounters.md, so the markdown stays the single
// source of truth for encounter text. Run by `npm run build` before packing:
//   node scripts/build-journal.ts
// Ids derive from a hash of each page's slug, so rebuilding keeps every @UUID link stable.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

const ROOT = process.cwd();
const MODULE_ID = 'points-of-interest';
const PACK = 'journals';
const OUT = join(ROOT, 'packs', '_source', PACK);
const NOTES_DIR = join(ROOT, 'assets', 'map-notes');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function stableId(key: string): string {
  const hash = createHash('sha256').update(`${MODULE_ID}:${key}`).digest();
  return Array.from(hash.subarray(0, 16), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// GitHub's heading-anchor rule, which the markdown links were written against.
function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');
}

interface Section { number: number; title: string; slug: string; body: string }

const source = readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8');
const firstZone = source.search(/^## Zone /m);
const overviewMd = source.slice(0, firstZone).replace(/^# .*\n/, '').replace(/\n---\s*$/, '');

const sections: Section[] = [];
const headingRe = /^### (\d+)\. (.+)$/gm;
const headings = [...source.matchAll(headingRe)];
headings.forEach((match, i) => {
  const start = match.index! + match[0].length;
  const end = i + 1 < headings.length ? headings[i + 1].index! : source.length;
  const body = source
    .slice(start, end)
    .replace(/\n---\s*\n+## [^\n]*\n*$/, '\n')
    .replace(/\n---\s*$/, '\n')
    .trim();
  const number = Number(match[1]);
  sections.push({ number, title: match[2].trim(), slug: slugify(`${match[1]}. ${match[2]}`), body });
});
sections.sort((a, b) => a.number - b.number);

const encountersId = stableId('journal:encounters');
const overviewPageId = stableId('page:overview');
const pageIds = new Map(sections.map((s) => [s.slug, stableId(`page:${s.slug}`)]));

function pageUuid(pageId: string): string {
  return `Compendium.${MODULE_ID}.${PACK}.JournalEntry.${encountersId}.JournalEntryPage.${pageId}`;
}

// Markdown anchor links become Foundry content links to the matching page.
function linkify(md: string): string {
  return md.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, (whole, text: string, slug: string) => {
    const id = pageIds.get(slug);
    return id ? `@UUID[${pageUuid(id)}]{${text}}` : whole;
  });
}

const pad = (n: number): string => String(n).padStart(2, '0');
function mapNotePath(number: number): string | undefined {
  if (!existsSync(NOTES_DIR)) return undefined;
  const file = readdirSync(NOTES_DIR).find((f) => f.startsWith(`${pad(number)}-`));
  return file ? `modules/${MODULE_ID}/assets/map-notes/${file}` : undefined;
}

function textPage(entryId: string, pageId: string, name: string, html: string, sort: number) {
  return {
    _id: pageId,
    _key: `!journal.pages!${entryId}.${pageId}`,
    name,
    type: 'text',
    title: { show: true, level: 1 },
    text: { format: 1, content: html },
    sort,
    ownership: { default: -1 },
    flags: {},
  };
}

function imagePage(entryId: string, pageId: string, name: string, src: string, caption: string, sort: number) {
  return {
    _id: pageId,
    _key: `!journal.pages!${entryId}.${pageId}`,
    name,
    type: 'image',
    title: { show: true, level: 1 },
    src,
    image: { caption },
    sort,
    ownership: { default: -1 },
    flags: {},
  };
}

function entry(id: string, name: string, pages: unknown[], sort: number) {
  return {
    _id: id,
    _key: `!journal!${id}`,
    name,
    pages,
    folder: null,
    sort,
    ownership: { default: 0 },
    flags: {},
  };
}

// The encounter header tables are key/value pairs with a blank header row; drop it.
const render = (md: string): string =>
  (marked.parse(linkify(md), { async: false }) as string).replace(/<thead>\s*<tr>\s*(<th><\/th>\s*)+<\/tr>\s*<\/thead>\s*/g, '');

const encounterPages = [
  textPage(encountersId, overviewPageId, 'Overview', render(overviewMd), 0),
  ...sections.map((s) => {
    const note = mapNotePath(s.number);
    const img = note ? `<p><img src="${note}" alt="Irovetti's map note: ${s.title}"></p>\n` : '';
    return textPage(encountersId, pageIds.get(s.slug)!, `${pad(s.number)}. ${s.title}`, img + render(s.body), s.number * 1000);
  }),
];

const notesId = stableId('journal:map-notes');
const notePages = sections.flatMap((s) => {
  const note = mapNotePath(s.number);
  if (!note) return [];
  const caption = `Irovetti's note on the map: ${s.title}`;
  return [imagePage(notesId, stableId(`note:${s.slug}`), `${pad(s.number)}. ${s.title}`, note, caption, s.number * 1000)];
});

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const docs = [
  { file: 'irovettis-map-encounters.json', doc: entry(encountersId, "Irovetti's Map: Encounters", encounterPages, 0) },
  { file: 'irovettis-map-notes.json', doc: entry(notesId, "Irovetti's Map: Notes (Handouts)", notePages, 1000) },
];
for (const { file, doc } of docs) writeFileSync(join(OUT, file), `${JSON.stringify(doc, null, 2)}\n`);
console.log(`journal: ${encounterPages.length} encounter pages, ${notePages.length} map-note handouts → packs/_source/${PACK}`);

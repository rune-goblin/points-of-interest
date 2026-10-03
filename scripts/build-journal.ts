// Generate the journal pack sources from docs/encounters.md, so the markdown stays the single
// source of truth for encounter text. Run by `npm run build` before packing:
//   node scripts/build-journal.ts
// Each site gets its own entry (map-note handout + encounter text) beside one overview entry.
// Ids derive from a hash of each heading's slug, so rebuilding keeps every @UUID link and every
// placed map note stable.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';
import { MODULE_ID, ids, pad, slugify, stableId } from './stable-id.ts';

const ROOT = process.cwd();
const PACK = 'journals';
const OUT = join(ROOT, 'packs', '_source', PACK);

interface Section { number: number; title: string; slug: string; hex: string; body: string }

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
  // The placement key the Kingmaker module uses for region-map hexes: "row.column".
  const hex = body.match(/^\| \*\*Hex\*\* \| (\d+\.\d+)\b/m)?.[1];
  if (!hex) throw new Error(`docs/encounters.md: "${match[0]}" has no | **Hex** | row in its header table`);
  sections.push({ number, title: match[2].trim(), slug: slugify(`${match[1]}. ${match[2]}`), hex, body });
});
sections.sort((a, b) => a.number - b.number);

const slugs = new Set(sections.map((s) => s.slug));

function pageUuid(entryId: string, pageId: string): string {
  return `Compendium.${MODULE_ID}.${PACK}.JournalEntry.${entryId}.JournalEntryPage.${pageId}`;
}

// Markdown anchor links become Foundry content links to the matching site's encounter page.
function linkify(md: string): string {
  return md.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, (whole, text: string, slug: string) =>
    slugs.has(slug) ? `@UUID[${pageUuid(ids.siteJournal(slug), ids.encounterPage(slug))}]{${text}}` : whole,
  );
}

function artPath(dir: string, number: number): string | undefined {
  const path = join(ROOT, 'assets', dir);
  if (!existsSync(path)) return undefined;
  const file = readdirSync(path).find((f) => f.startsWith(`${pad(number)}-`));
  return file ? `modules/${MODULE_ID}/assets/${dir}/${file}` : undefined;
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

function entry(id: string, name: string, pages: unknown[], sort: number, flags: Record<string, unknown> = {}) {
  return {
    _id: id,
    _key: `!journal!${id}`,
    name,
    pages,
    folder: null,
    sort,
    ownership: { default: 0 },
    flags,
  };
}

interface PackDoc { _id: string; _key: string; name: string; sort?: number; flags?: Record<string, Record<string, unknown>> }

// Scenes and actors carry their encounter number in a module flag, so each page can link its own.
function byEncounter(pack: string, collection: string): Map<number, PackDoc[]> {
  const dir = join(ROOT, 'packs', '_source', pack);
  const groups = new Map<number, PackDoc[]>();
  if (!existsSync(dir)) return groups;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8')) as PackDoc;
    const encounter = doc.flags?.[MODULE_ID]?.encounter;
    if (!doc._key.startsWith(`!${collection}!`) || typeof encounter !== 'number') continue;
    groups.set(encounter, [...(groups.get(encounter) ?? []), doc]);
  }
  for (const docs of groups.values()) docs.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
  return groups;
}

const scenesByEncounter = byEncounter('scenes', 'scenes');
const actorsByEncounter = byEncounter('actors', 'actors');

function contentLinks(number: number): string {
  const groups = [
    { label: ['Scene', 'Scenes'], pack: 'scenes', type: 'Scene', docs: scenesByEncounter.get(number) ?? [] },
    { label: ['Actor', 'Actors'], pack: 'actors', type: 'Actor', docs: actorsByEncounter.get(number) ?? [] },
  ];
  return groups
    .filter((g) => g.docs.length)
    .map((g) => {
      const links = g.docs.map((d) => `@UUID[Compendium.${MODULE_ID}.${g.pack}.${g.type}.${d._id}]{${d.name}}`);
      return `<p><strong>${g.label[g.docs.length > 1 ? 1 : 0]}:</strong> ${links.join(', ')}</p>\n`;
    })
    .join('');
}

// The encounter header tables are key/value pairs with a blank header row; drop it.
const render = (md: string): string =>
  (marked.parse(linkify(md), { async: false }) as string).replace(/<thead>\s*<tr>\s*(<th><\/th>\s*)+<\/tr>\s*<\/thead>\s*/g, '');

const overviewId = ids.overviewJournal();
const overview = entry(overviewId, "Irovetti's Map: Overview", [
  textPage(overviewId, stableId('page:overview'), 'Overview', render(overviewMd), 0),
], 0);

// The handout page comes first: map notes link to it, so its ownership decides when players see
// the note on the map.
function siteEntry(s: Section) {
  const id = ids.siteJournal(s.slug);
  const note = artPath('map-notes', s.number);
  const handout = note
    ? [imagePage(id, ids.handoutPage(s.slug), "Irovetti's Note", note, `Irovetti's note on the map: ${s.title}`, 1000)]
    : [];
  const encounter = textPage(id, ids.encounterPage(s.slug), 'Encounter', contentLinks(s.number) + render(s.body), 2000);
  const icon = artPath('map-icons', s.number) ?? note;
  return entry(id, `${pad(s.number)}. ${s.title}`, [...handout, encounter], s.number * 1000, {
    [MODULE_ID]: { site: s.number, hex: s.hex, ...(icon ? { icon } : {}) },
  });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const docs = [
  { file: 'irovettis-map-overview.json', doc: overview },
  ...sections.map((s) => ({ file: `${pad(s.number)}-${slugify(s.title)}.json`, doc: siteEntry(s) })),
];
for (const { file, doc } of docs) writeFileSync(join(OUT, file), `${JSON.stringify(doc, null, 2)}\n`);
console.log(`journal: overview + ${sections.length} site entries → packs/_source/${PACK}`);

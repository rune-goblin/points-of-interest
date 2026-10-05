// Generate the journal pack source from docs/encounters.md, so the markdown stays the single
// source of truth for encounter text. Run by `npm run build` before packing:
//   node scripts/build-journal.ts
// One journal holds the overview and every site, grouped into a category per zone. Each site has an
// encounter page headed by its scenes and creatures, then the King's note as an image page beneath it.
// Ids derive from a hash of each heading's slug, so rebuilding keeps every @UUID link and every
// placed map note stable.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';
import { MODULE_ID, ids, pad, slugify, stableId } from './stable-id.ts';

const ROOT = process.cwd();
const PACK = 'journals';
const OUT = join(ROOT, 'packs', '_source', PACK);
const SERVED = `modules/${MODULE_ID}/`;
const PREVIEW_WIDTH = 800;

interface Zone { title: string; slug: string }
interface Section { number: number; title: string; slug: string; hex: string; zone: Zone; body: string }

const source = readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8');
const firstZone = source.search(/^## Zone /m);
const overviewMd = source.slice(0, firstZone).replace(/^# .*\n/, '').replace(/\n---\s*$/, '');

const zoneHeadings = [...source.slice(firstZone).matchAll(/^## (.+)$/gm)].map((m) => ({
  index: firstZone + m.index!,
  zone: { title: m[1].trim(), slug: slugify(m[1]) },
}));

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
  const zone = zoneHeadings.filter((z) => z.index < match.index!).at(-1)?.zone;
  if (!zone) throw new Error(`docs/encounters.md: "${match[0]}" sits under no ## zone heading`);
  sections.push({ number, title: match[2].trim(), slug: slugify(`${match[1]}. ${match[2]}`), hex, zone, body });
});
sections.sort((a, b) => a.number - b.number);

const slugs = new Set(sections.map((s) => s.slug));
const journalId = ids.journal();

function pageUuid(pageId: string): string {
  return `Compendium.${MODULE_ID}.${PACK}.JournalEntry.${journalId}.JournalEntryPage.${pageId}`;
}

// Markdown anchor links become Foundry content links to the matching site's encounter page.
function linkify(md: string): string {
  return md.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, (whole, text: string, slug: string) =>
    slugs.has(slug) ? `@UUID[${pageUuid(ids.encounterPage(slug))}]{${text}}` : whole,
  );
}

function artPath(dir: string, number: number): string | undefined {
  const path = join(ROOT, 'assets', dir);
  if (!existsSync(path)) return undefined;
  const file = readdirSync(path).find((f) => f.startsWith(`${pad(number)}-`));
  return file ? `${SERVED}assets/${dir}/${file}` : undefined;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface PageOptions { category: string; level: number; sort: number }

function textPage(pageId: string, name: string, html: string, { category, level, sort }: PageOptions, flags = {}) {
  return {
    _id: pageId,
    _key: `!journal.pages!${journalId}.${pageId}`,
    name,
    type: 'text',
    title: { show: true, level },
    text: { format: 1, content: html },
    category,
    sort,
    ownership: { default: -1 },
    flags,
  };
}

function imagePage(pageId: string, name: string, src: string, caption: string, { category, level, sort }: PageOptions) {
  return {
    _id: pageId,
    _key: `!journal.pages!${journalId}.${pageId}`,
    name,
    type: 'image',
    title: { show: true, level },
    src,
    image: { caption },
    category,
    sort,
    ownership: { default: -1 },
    flags: {},
  };
}

function category(id: string, name: string, sort: number) {
  return { _id: id, _key: `!journal.categories!${journalId}.${id}`, name, sort, flags: {} };
}

interface PackDoc { _id: string; _key: string; name: string; sort?: number; flags?: Record<string, Record<string, unknown>> }
interface SceneDoc extends PackDoc { levels: { background: { src: string } }[]; tokens: { actorId: string }[] }
interface ActorDoc extends PackDoc { type: string; prototypeToken: { texture: { src: string } } }

// Scenes and actors carry their encounter number in a module flag, so each page can show its own.
function byEncounter<T extends PackDoc>(pack: string, collection: string): Map<number, T[]> {
  const dir = join(ROOT, 'packs', '_source', pack);
  const groups = new Map<number, T[]>();
  if (!existsSync(dir)) return groups;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;
    const encounter = doc.flags?.[MODULE_ID]?.encounter;
    if (!doc._key.startsWith(`!${collection}!`) || typeof encounter !== 'number') continue;
    groups.set(encounter, [...(groups.get(encounter) ?? []), doc]);
  }
  for (const docs of groups.values()) docs.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
  return groups;
}

const scenesByEncounter = byEncounter<SceneDoc>('scenes', 'scenes');
const actorsByEncounter = byEncounter<ActorDoc>('actors', 'actors');

// Previews are committed art like the scene thumbnails; cwebp runs only to make a missing one.
function scenePreview(scene: SceneDoc): string {
  const map = scene.levels[0].background.src;
  const preview = map.replace('/assets/maps/', '/assets/maps/previews/');
  const file = join(ROOT, preview.slice(SERVED.length));
  if (!existsSync(file)) {
    mkdirSync(join(file, '..'), { recursive: true });
    execFileSync('cwebp', ['-quiet', '-q', '75', '-resize', String(PREVIEW_WIDTH), '0', join(ROOT, map.slice(SERVED.length)), '-o', file]);
  }
  return preview;
}

// The module's click handler views (or imports, then views) the scene. A core content link would
// open the scene's linked journal instead, which is this very page.
function sceneCard(scene: SceneDoc): string {
  const name = scene.name.replace(/^\d+\. /, '');
  return `<a class="poi-scene" data-scene="${scene._id}" data-tooltip="View this scene"><img class="nopopout" src="${scenePreview(scene)}" alt=""><span>${escapeHtml(name)}</span></a>`;
}

const TYPE_ORDER = ['npc', 'hazard', 'loot'];
const KIND_LABEL: Record<string, string> = { hazard: 'Hazard', remains: 'Remains', cache: 'Treasure' };

function tokenLink(actor: ActorDoc, count: number): string {
  const label = KIND_LABEL[String(actor.flags?.[MODULE_ID]?.kind)];
  return (
    `<a class="poi-token" draggable="true" data-link="" data-uuid="Compendium.${MODULE_ID}.actors.Actor.${actor._id}" ` +
    `data-id="${actor._id}" data-type="Actor" data-tooltip="Open, or drag onto a scene">` +
    `<img class="nopopout" src="${actor.prototypeToken.texture.src}" alt=""><span>${escapeHtml(actor.name)}${count > 1 ? ` ×${count}` : ''}</span>` +
    `${label ? `<small>${label}</small>` : ''}</a>`
  );
}

function cast(actors: ActorDoc[], counts: Map<string, number>): string {
  const sorted = [...actors].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  return `<div class="poi-cast">${sorted.map((a) => tokenLink(a, counts.get(a._id) ?? 1)).join('')}</div>`;
}

// Each scene lists the creatures placed on it; actors no scene places get a row of their own.
function siteHeader(number: number): string {
  const scenes = scenesByEncounter.get(number) ?? [];
  const actors = actorsByEncounter.get(number) ?? [];
  const placed = new Set<string>();
  const blocks = scenes.map((scene) => {
    const counts = new Map<string, number>();
    for (const t of scene.tokens) counts.set(t.actorId, (counts.get(t.actorId) ?? 0) + 1);
    const onScene = actors.filter((a) => counts.has(a._id));
    for (const a of onScene) placed.add(a._id);
    return `<div class="poi-scene-block">${sceneCard(scene)}${onScene.length ? cast(onScene, counts) : ''}</div>`;
  });
  const offMap = actors.filter((a) => !placed.has(a._id));
  if (offMap.length) {
    blocks.push(`<div class="poi-scene-block"><p class="poi-label">Not on the map</p>${cast(offMap, new Map())}</div>`);
  }
  return blocks.length ? `<section class="poi-site">${blocks.join('\n')}</section>\n` : '';
}

// The encounter header tables are key/value pairs with a blank header row; drop it.
const render = (md: string): string =>
  (marked.parse(linkify(md), { async: false }) as string).replace(/<thead>\s*<tr>\s*(<th><\/th>\s*)+<\/tr>\s*<\/thead>\s*/g, '');

// The site header sits under the encounter's key/value table, so the facts read first.
function encounterHtml(s: Section): string {
  const html = render(s.body);
  const header = siteHeader(s.number);
  const end = html.indexOf('</table>');
  return end < 0 ? header + html : `${html.slice(0, end + 8)}\n${header}${html.slice(end + 8)}`;
}

const intro = category(ids.overviewCategory(), 'Overview', 0);
const zones = [...new Map(sections.map((s) => [s.zone.slug, s.zone])).values()];
const categories = [intro, ...zones.map((z, i) => category(ids.category(z.slug), z.title, (i + 1) * 1000))];
const categoryOf = (zone: Zone): string => ids.category(zone.slug);

function sitePages(s: Section) {
  const options = { category: categoryOf(s.zone), sort: s.number * 1000 };
  const icon = artPath('map-icons', s.number) ?? artPath('map-notes', s.number);
  const encounter = textPage(ids.encounterPage(s.slug), `${pad(s.number)}. ${s.title}`, encounterHtml(s), { ...options, level: 1 }, {
    [MODULE_ID]: { site: s.number, hex: s.hex, ...(icon ? { icon } : {}) },
  });
  const note = artPath('map-notes', s.number);
  if (!note) return [encounter];
  const handout = imagePage(ids.handoutPage(s.slug), "The King's Note", note, `The King's note on the map: ${s.title}`, {
    ...options,
    level: 2,
    sort: options.sort + 500,
  });
  return [encounter, handout];
}

// Limited lets players see each site's map note on the region map; every page needs Observer to read.
const LIMITED = 1;

const journal = {
  _id: journalId,
  _key: `!journal!${journalId}`,
  name: "Points of Interest",
  pages: [
    textPage(stableId('page:overview'), 'Overview', render(overviewMd), { category: intro._id, level: 1, sort: 0 }),
    ...sections.flatMap(sitePages),
  ],
  categories,
  folder: null,
  sort: 0,
  ownership: { default: LIMITED },
  flags: {},
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'points-of-interest.json'), `${JSON.stringify(journal, null, 2)}\n`);
console.log(`journal: overview + ${sections.length} sites in ${zones.length} zones → packs/_source/${PACK}`);

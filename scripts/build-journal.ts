// Generate the journal pack source from docs/encounters.md, so the markdown stays the single
// source of truth for encounter text. Run by `npm run build` before packing:
//   node scripts/build-journal.ts
// One journal holds the overview and every site, in encounter order. Each site has one encounter page
// headed by establishing art and creatures, then its sections (scripts/journal-html.ts).
// Ids derive from a hash of each heading's slug, so rebuilding keeps every @UUID link and every
// placed map note stable.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';
import { encounterParts, overviewHtml, PAGE_RULE, type Renderers } from './journal-html.ts';
import { MODULE_ID, ids, pad, rootFolder, slugify, stableId } from './stable-id.ts';

const ROOT = process.cwd();
const PACK = 'journals';
const OUT = join(ROOT, 'packs', '_source', PACK);
const SERVED = `modules/${MODULE_ID}/`;
const PREVIEW_WIDTH = 800;

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

interface PageOptions { level: number; sort: number }

function textPage(pageId: string, name: string, html: string, { level, sort }: PageOptions, flags = {}) {
  return {
    _id: pageId,
    _key: `!journal.pages!${journalId}.${pageId}`,
    name,
    type: 'text',
    title: { show: true, level },
    text: { format: 1, content: html },
    sort,
    ownership: { default: -1 },
    flags,
  };
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

// Match the exact scene filename: the Juggernaut's exterior and cargo hold have separate artwork.
// The banner opens the establishing image; the buttons share it with players, or open the tactical map or the scene.
function sceneCard(scene: SceneDoc, showName: boolean): string {
  const name = escapeHtml(scene.name.replace(/^\d+\. /, ''));
  const map = scene.levels[0].background.src;
  const establishing = map.replace('/assets/maps/', '/assets/establishing/');
  const art = existsSync(join(ROOT, establishing.slice(SERVED.length))) ? establishing : scenePreview(scene);
  const image = `<a class="poi-scene-art" href="${art}" data-image="${art}" data-caption="${name}" aria-label="Expand ${name}">` +
    `<img class="nopopout" src="${art}" alt="${name}" loading="lazy"></a>`;
  const buttons = `<div class="poi-scene-actions">` +
    `<button type="button" class="poi-show-players" data-image="${art}" data-caption="${name}" aria-label="Show to players: ${name}"><i class="fa-solid fa-eye" aria-hidden="true"></i>Show to players</button>` +
    `<button type="button" class="poi-show-map" data-map="${map}" data-caption="${name}" aria-label="Show map: ${name}"><i class="fa-solid fa-map" aria-hidden="true"></i>Show map</button>` +
    `<button type="button" class="poi-open-scene" data-scene="${scene._id}" aria-label="Open scene: ${name}"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>Open scene</button></div>`;
  return `<figure class="poi-scene-card">${image}${buttons}${showName ? `<figcaption>${name}</figcaption>` : ''}</figure>`;
}

const TYPE_ORDER = ['npc', 'hazard', 'loot'];
const KIND_LABEL: Record<string, string> = { hazard: 'Hazard', remains: 'Remains', cache: 'Treasure' };

function illumination(number: number): 'night' | 'grove' | 'relic' {
  if ([2, 4, 6, 12, 15, 17].includes(number)) return 'grove';
  if ([8, 9, 11, 20, 21].includes(number)) return 'relic';
  return 'night';
}

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
    return `<div class="poi-scene-block">${sceneCard(scene, scenes.length > 1)}${onScene.length ? cast(onScene, counts) : ''}</div>`;
  });
  const offMap = actors.filter((a) => !placed.has(a._id));
  if (offMap.length) {
    blocks.push(`<div class="poi-scene-block"><p class="poi-label">Not on the map</p>${cast(offMap, new Map())}</div>`);
  }
  return blocks.length ? `<section class="poi-site" data-illumination="${illumination(number)}">${blocks.join('\n')}</section>\n` : '';
}

// The encounter header tables are key/value pairs with a blank header row; drop it.
const renderers: Renderers = {
  block: (md) =>
    (marked.parse(linkify(md), { async: false }) as string).replace(/<thead>\s*<tr>\s*(<th><\/th>\s*)+<\/tr>\s*<\/thead>\s*/g, ''),
  inline: (md) => marked.parseInline(linkify(md), { async: false }) as string,
};

// Foundry pops out an image clicked in a page, titled by its title attribute, and the popout's
// Show Players shares only the image, so the note needs no image page of its own.
function kingsNote(s: Section, caption?: string): string {
  const note = artPath('map-notes/white-ink', s.number);
  if (!note) return '';
  const alt = escapeHtml(`The King's note on the map: ${s.title}`);
  const text = caption ? `<figcaption>${caption}</figcaption>` : '';
  return `<figure class="poi-note"><img src="${note}" title="The King's Note" alt="${alt}">${text}</figure>\n`;
}

// The establishing image and cast share the dark banner; prose follows at its own reading measure.
function encounterHtml(s: Section): string {
  const { facts, caption, background, body } = encounterParts(s.body, renderers);
  const metadata = [...s.body.matchAll(/^\| \*\*(?:Type|Threat)\*\* \| (.+?) \|$/gm)]
    .map((match) => `<span>${renderers.inline(match[1])}</span>`).join('');
  const head = `<header class="poi-masthead"><h1 data-no-toc>${escapeHtml(s.title)}</h1><p class="poi-metadata">${metadata}</p>${PAGE_RULE}</header>`;
  const reference = `<details class="poi-reference"><summary>The King's note &amp; encounter details</summary>` +
    `<div class="poi-reference-body">${kingsNote(s, caption)}${facts}</div></details>`;
  return `${head}${siteHeader(s.number)}<div class="poi-body" data-illumination="${illumination(s.number)}">${reference}${background}${body}${PAGE_RULE}</div>`;
}

function sitePage(s: Section) {
  const icon = artPath('map-icons', s.number);
  return textPage(ids.encounterPage(s.slug), `${pad(s.number)}. ${s.title}`, encounterHtml(s), { level: 1, sort: s.number * 1000 }, {
    [MODULE_ID]: { site: s.number, hex: s.hex, ...(icon ? { icon } : {}) },
  });
}

// Limited lets players see each site's map note on the region map; every page needs Observer to read.
const LIMITED = 1;

const journal = {
  _id: journalId,
  _key: `!journal!${journalId}`,
  name: "Points of Interest",
  pages: [
    textPage(stableId('page:overview'), 'Overview', overviewHtml(overviewMd, renderers), { level: 1, sort: 0 }),
    ...sections.map(sitePage),
  ],
  categories: [],
  folder: rootFolder('JournalEntry')._id,
  sort: 0,
  ownership: { default: LIMITED },
  flags: {},
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, '_folder.json'), `${JSON.stringify(rootFolder('JournalEntry'), null, 2)}\n`);
writeFileSync(join(OUT, 'points-of-interest.json'), `${JSON.stringify(journal, null, 2)}\n`);
console.log(`journal: overview + ${sections.length} sites → packs/_source/${PACK}`);

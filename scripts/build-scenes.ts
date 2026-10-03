// Generate the scene pack sources: one scene per tactical map in assets/maps/, each linked to its
// encounter's journal page, with the encounter's actors placed as tokens. Run by `npm run build`
// before packing:
//   node scripts/build-scenes.ts
// Thumbnails are committed art; cwebp runs only to make a missing one, so CI never needs it.
// Placeables (tokens, walls, lights, …) edited in Foundry and unpacked over packs/_source/scenes
// survive regeneration; only a scene with no tokens yet gets the seeded layout below.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_ID, ids, pad, slugify, stableId } from './stable-id.ts';

const ROOT = process.cwd();
const PACK = 'scenes';
const OUT = join(ROOT, 'packs', '_source', PACK);
const MAPS_DIR = join(ROOT, 'assets', 'maps');
const THUMBS_DIR = join(MAPS_DIR, 'thumbs');
const THUMB = { width: 300, height: 100 }; // Foundry's own Scene#createThumbnail size
const PADDING = 0.1;

// Foundry's id for a scene's only level; its v13→v14 migration uses the same one.
const LEVEL_ID = 'defaultLevel0000';
const CORE_VERSION = '14.368';
const SYSTEM_VERSION = '8.5.1';

type Environment = 'aquatic' | 'arctic' | 'desert' | 'forest' | 'mountain' | 'plains' | 'swamp' | 'underground' | 'urban';
interface Tint { hue: number; intensity: number; saturation?: number }
interface MapMeta {
  /** Pixels per 5-foot square. The art has no drawn grid, so each size is judged from the map. */
  grid: number;
  why: string;
  environments: Environment[];
  /** Suffix for a second map of the same encounter. */
  label?: string;
  /** PF2e reads 0.25 or less as bright light and above 0.25 up to 0.75 as dim light. */
  darkness?: number;
  tint?: Tint;
}

const MAPS: Record<string, MapMeta> = {
  '01-shadowless-lodge': { grid: 120, why: 'great hall about 40 ft across, bedrolls about 7 ft', environments: ['forest'] },
  '02-perfect-song': { grid: 60, why: 'the birds pace a ring about 60 ft from the composers', environments: ['plains'], darkness: 0.25, tint: { hue: 30 / 360, intensity: 0.3 } },
  '03-nine-mouths-one-belly': { grid: 80, why: 'barrow chamber about 20 ft wide, room for a Huge troll to turn', environments: ['swamp'] },
  '04-gardeners': { grid: 48, why: 'maze corridors read about 7 ft; the text\'s 15 ft would need 24 px squares', environments: ['plains'] },
  '05-ossuary-wall': { grid: 72, why: 'inner court about 80 ft across', environments: ['mountain'] },
  '06-larder': { grid: 120, why: 'log cages about 10 ft, smokehouse about 30 ft', environments: ['forest'] },
  '07-wyvern-queens-hunting-ground': { grid: 96, why: 'hanging mammoth about 18 ft; room for a flying fight', environments: ['mountain', 'forest'] },
  '08-lightwardens': { grid: 120, why: 'scorched ring about 80 ft across, hatch about 10 ft', environments: ['plains'] },
  '09-iron-juggernaut': { grid: 60, why: 'patrol trench about 30 ft wide', environments: ['plains'] },
  '09-iron-juggernaut-cargo-hold': { grid: 144, label: 'Cargo Hold', why: 'each seated captive fills about one square', environments: [], darkness: 0.6 },
  '10-scouts-wager': { grid: 120, why: 'escape pod about 25 ft, crater about 80 ft across', environments: ['plains'] },
  '11-unmaker': { grid: 60, why: 'capacitor drums about 80 ft from the centre', environments: ['plains'] },
  '12-storm-tree': { grid: 120, why: 'tents 10 to 15 ft; strongbox about 35 ft from the sard', environments: ['forest'] },
  '13-quilled-hunter': { grid: 80, why: 'canyon floor 15 to 80 ft wide', environments: ['forest'], tint: { hue: 120 / 360, intensity: 0.2 } },
  '14-shadow-court': { grid: 120, why: 'stone table about 15 ft, grove about 80 ft across', environments: ['forest'], darkness: 0.5 },
  '15-moody-brood': { grid: 120, why: 'picnic table about 15 ft', environments: ['forest'] },
  '16-lantern-kings-emissary': { grid: 120, why: 'stone ring about 45 ft, wide enough for a Gargantuan zomok', environments: ['forest'] },
  '17-spore-dawn': { grid: 96, why: 'sinkhole about 100 ft across, the width of the spore', environments: ['forest'], tint: { hue: 0, intensity: 0, saturation: -0.5 } },
  '18-linnorms-pass': { grid: 72, why: 'the two narrows about 15 ft', environments: ['mountain'] },
  '19-shadow-on-the-peaks': { grid: 80, why: 'summit about 80 ft across, trail about 5 ft', environments: ['mountain', 'swamp'] },
  '20-burning-giant': { grid: 80, why: 'cottages about 20 by 15 ft, well-house about 10 ft', environments: ['plains'] },
  '21-annihilator': { grid: 80, why: 'farmhouse about 30 by 25 ft, well about 10 ft', environments: ['plains'] },
};

// Parse the WebP header (VP8, VP8L or VP8X) so the build needs no image tool on CI.
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${file} is not a WebP`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  throw new Error(`${file}: unknown WebP chunk ${chunk}`);
}

function ensureThumb(mapFile: string, slug: string, size: { width: number; height: number }): string {
  const thumb = join(THUMBS_DIR, `${slug}.webp`);
  if (!existsSync(thumb)) {
    mkdirSync(THUMBS_DIR, { recursive: true });
    const aspect = THUMB.width / THUMB.height;
    const [w, h] = size.width / size.height > aspect
      ? [Math.round(size.height * aspect), size.height]
      : [size.width, Math.round(size.width / aspect)];
    const crop = [Math.round((size.width - w) / 2), Math.round((size.height - h) / 2), w, h].map(String);
    execFileSync('cwebp', ['-quiet', '-q', '80', '-crop', ...crop, '-resize', String(THUMB.width), String(THUMB.height), mapFile, '-o', thumb]);
  }
  return `modules/${MODULE_ID}/assets/maps/thumbs/${slug}.webp`;
}

const ACTORS_DIR = join(ROOT, 'packs', '_source', 'actors');
const TOKENS_DIR = join(ROOT, 'assets', 'tokens');

// Keyed by actor slug (the shared portrait/token file name).
const VOICE_ONLY = new Set(['03-envoy-troll-head', '03-old-heads', '05-magister-corwen-ash', '05-dalia-sorn', '05-hemmet-brask', '05-lio-venn']);
/** Tokens for later states, optional extras and unnoticed hazards start hidden from players. */
const HIDDEN = new Set([
  '01-ankou-shadow-double-first', '01-ankou-shadow-double-second', '05-skeletal-champion', '05-lament-of-the-wall',
  '07-minognos-ushad-diving', '08-radiant-warden-active', '14-spared-ankou', '19-ilthuliak-ambush',
]);
const COPIES: Record<string, number> = { '08-defence-pylon': 3 };
/** Scenes that hold only part of their encounter's cast; every other scene takes the whole encounter. */
const SCENE_CAST: Record<string, string[]> = {
  '09-iron-juggernaut': ['09-iron-juggernaut'],
  '09-iron-juggernaut-cargo-hold': ['09-brann-kesk', '09-ottilie-kesk', '09-tarku'],
};

interface ActorSource {
  _id: string;
  _key: string;
  name: string;
  sort?: number;
  flags: Record<string, { encounter?: number }>;
  prototypeToken: Record<string, unknown> & { width: number; height: number };
}
interface CastMember { slug: string; actor: ActorSource }

function readCast(): Map<number, CastMember[]> {
  const slugById = new Map(
    // The haunt is the one actor without token art of its own.
    [...readdirSync(TOKENS_DIR).map((f) => f.replace(/\.webp$/, '')), '05-lament-of-the-wall'].map((slug) => [ids.actor(slug), slug]),
  );
  const cast = new Map<number, CastMember[]>();
  if (!existsSync(ACTORS_DIR)) return cast;
  for (const file of readdirSync(ACTORS_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const actor = JSON.parse(readFileSync(join(ACTORS_DIR, file), 'utf8')) as ActorSource;
    if (!actor._key.startsWith('!actors!')) continue;
    const slug = slugById.get(actor._id);
    const encounter = actor.flags[MODULE_ID]?.encounter;
    if (!slug || encounter === undefined) throw new Error(`${file}: no art slug or encounter flag for actor ${actor.name}`);
    if (VOICE_ONLY.has(slug)) continue;
    cast.set(encounter, [...(cast.get(encounter) ?? []), { slug, actor }]);
  }
  return cast;
}

// Rows of tokens centred on the map, one empty square apart, for the GM to drag into place.
function seedTokens(sceneId: string, slug: string, members: CastMember[], size: { width: number; height: number }, grid: number) {
  const pieces = members.flatMap((m) => Array.from({ length: COPIES[m.slug] ?? 1 }, (_, copy) => ({ ...m, copy })));
  const across = Math.floor(size.width / grid);
  const maxRow = Math.max(4, Math.floor(across * 0.6));
  const rows: (typeof pieces)[] = [[]];
  let rowWidth = 0;
  for (const piece of pieces) {
    const w = piece.actor.prototypeToken.width;
    if (rows.at(-1)!.length && rowWidth + 1 + w > maxRow) {
      rows.push([]);
      rowWidth = 0;
    }
    rowWidth += (rows.at(-1)!.length ? 1 : 0) + w;
    rows.at(-1)!.push(piece);
  }
  const rowHeights = rows.map((r) => Math.max(1, ...r.map((p) => p.actor.prototypeToken.height)));
  const total = rowHeights.reduce((a, b) => a + b, 0) + rows.length - 1;
  // Token x/y are canvas coordinates, which start at the padding Foundry adds around the map.
  const padX = Math.ceil((PADDING * size.width) / grid) * grid;
  const padY = Math.ceil((PADDING * size.height) / grid) * grid;
  let top = Math.floor((size.height / grid - total) / 2);
  return rows.flatMap((row, r) => {
    const width = row.reduce((a, p) => a + p.actor.prototypeToken.width, 0) + row.length - 1;
    let left = Math.floor((across - width) / 2);
    const placed = row.map((piece, i) => {
      const token = piece.actor.prototypeToken;
      const id = stableId(`token:${slug}:${piece.slug}:${piece.copy}`);
      const doc = {
        ...token,
        _id: id,
        _key: `!scenes.tokens!${sceneId}.${id}`,
        actorId: piece.actor._id,
        x: padX + Math.round(left * grid),
        y: padY + Math.round(top * grid),
        elevation: 0,
        level: LEVEL_ID,
        hidden: HIDDEN.has(piece.slug),
        locked: false,
        sort: i,
      };
      left += token.width + 1;
      return doc;
    });
    top += rowHeights[r] + 1;
    return placed;
  });
}

const PLACEABLES = ['drawings', 'tokens', 'lights', 'notes', 'sounds', 'regions', 'tiles', 'walls'] as const;
type Placeables = Partial<Record<(typeof PLACEABLES)[number], unknown[]>>;

// Newest file wins, so a fresh `fvtt package unpack` beats the generator's previous output.
function readPrevious(): Map<string, Placeables> {
  const previous = new Map<string, Placeables>();
  if (!existsSync(OUT)) return previous;
  const files = readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => join(OUT, f));
  files.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  for (const file of files) {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as Placeables & { _id: string; _key?: string };
    if (doc._key?.startsWith('!scenes!')) previous.set(doc._id, doc);
  }
  return previous;
}

interface Encounter { number: number; title: string; zone: string }
function readEncounters(): Map<number, Encounter> {
  const encounters = new Map<number, Encounter>();
  let zone = '';
  for (const line of readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8').split('\n')) {
    const zoneMatch = /^## (.+)$/.exec(line);
    if (zoneMatch) zone = zoneMatch[1].trim();
    const match = /^### (\d+)\. (.+)$/.exec(line);
    if (match) encounters.set(Number(match[1]), { number: Number(match[1]), title: match[2].trim(), zone });
  }
  return encounters;
}

const environmentData = (tint?: Tint) => ({
  hue: tint?.hue ?? 0,
  intensity: tint?.intensity ?? 0,
  luminosity: 0,
  saturation: tint?.saturation ?? 0,
  shadows: 0,
});

function scene(slug: string, meta: MapMeta, encounter: Encounter, folder: string, sort: number, cast: CastMember[], previous?: Placeables) {
  const mapFile = join(MAPS_DIR, `${slug}.webp`);
  const size = webpSize(mapFile);
  const id = ids.scene(slug);
  const kept = (key: (typeof PLACEABLES)[number]) => (previous?.[key]?.length ? previous[key] : []);
  const members = SCENE_CAST[slug] ? cast.filter((m) => SCENE_CAST[slug].includes(m.slug)) : cast;
  const name = `${pad(encounter.number)}. ${encounter.title}${meta.label ? `: ${meta.label}` : ''}`;
  const fixedLight = meta.darkness !== undefined;
  return {
    _id: id,
    _key: `!scenes!${id}`,
    name,
    active: false,
    navigation: false,
    navOrder: 0,
    navName: '',
    thumb: ensureThumb(mapFile, slug, size),
    width: size.width,
    height: size.height,
    padding: PADDING,
    shiftX: 0,
    shiftY: 0,
    initial: { x: null, y: null, scale: null },
    initialLevel: LEVEL_ID,
    grid: { type: 1, size: meta.grid, style: 'solidLines', thickness: 1, color: '#000000', alpha: 0.2, distance: 5, units: 'ft' },
    tokenVision: true,
    fog: { mode: 1, colors: { explored: null, unexplored: null } },
    environment: {
      darknessLevel: meta.darkness ?? 0,
      darknessLock: false,
      globalLight: {
        enabled: true,
        alpha: 0.5,
        bright: false,
        color: null,
        coloration: 1,
        luminosity: 0,
        saturation: 0,
        contrast: 0,
        shadows: 0,
        darkness: { min: 0, max: 1 },
      },
      cycle: true,
      base: environmentData(meta.tint),
      dark: { hue: 257 / 360, intensity: 0, luminosity: -0.25, saturation: 0, shadows: 0 },
    },
    transition: { type: null, duration: 1500, activeOnly: false },
    drawings: kept('drawings'),
    tokens: previous?.tokens?.length ? previous.tokens : seedTokens(id, slug, members, size, meta.grid),
    levels: [
      {
        _id: LEVEL_ID,
        _key: `!scenes.levels!${id}.${LEVEL_ID}`,
        name,
        elevation: { bottom: 0, top: null },
        background: { color: '#999999', src: `modules/${MODULE_ID}/assets/maps/${slug}.webp`, tint: '#ffffff', alphaThreshold: 0.75 },
        foreground: { src: null, tint: '#ffffff', alphaThreshold: 0.75 },
        fog: { src: null },
        textures: { anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, fit: 'fill', scaleX: 1, scaleY: 1, rotation: 0 },
        visibility: { levels: [] },
        sort: 0,
        flags: {},
      },
    ],
    lights: kept('lights'),
    notes: kept('notes'),
    sounds: kept('sounds'),
    regions: kept('regions'),
    tiles: kept('tiles'),
    walls: kept('walls'),
    playlist: null,
    playlistSound: null,
    journal: ids.siteJournal(slugify(`${encounter.number}. ${encounter.title}`)),
    journalEntryPage: ids.encounterPage(slugify(`${encounter.number}. ${encounter.title}`)),
    weather: '',
    folder,
    sort,
    ownership: { default: 0 },
    flags: {
      // A fixed light level must not follow the world clock.
      pf2e: { hearingRange: null, rulesBasedVision: null, syncDarkness: fixedLight ? 'disabled' : 'default', environmentTypes: meta.environments },
      [MODULE_ID]: { encounter: encounter.number },
    },
    // A current coreVersion stops Foundry's v13→v14 migration from replacing the levels on import.
    _stats: {
      coreVersion: CORE_VERSION,
      systemId: 'pf2e',
      systemVersion: SYSTEM_VERSION,
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null,
    },
  };
}

function folder(name: string, sort: number) {
  const id = stableId(`folder:scenes:${slugify(name)}`);
  return { _id: id, _key: `!folders!${id}`, name, type: 'Scene', folder: null, description: '', sorting: 'm', sort, color: null, flags: {} };
}

const encounters = readEncounters();
const casts = readCast();
const previous = readPrevious();
const slugs = readdirSync(MAPS_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')).sort();
const unlisted = slugs.filter((s) => !MAPS[s]);
if (unlisted.length) throw new Error(`Add a grid size to MAPS in build-scenes.ts for: ${unlisted.join(', ')}`);

const folders = new Map<string, ReturnType<typeof folder>>();
const scenes = slugs.map((slug) => {
  const number = Number(slug.slice(0, 2));
  const encounter = encounters.get(number);
  if (!encounter) throw new Error(`${slug}: no "### ${number}." heading in docs/encounters.md`);
  if (!folders.has(encounter.zone)) folders.set(encounter.zone, folder(encounter.zone, (folders.size + 1) * 1000));
  const meta = MAPS[slug];
  const sort = number * 1000 + (meta.label ? 1 : 0);
  const doc = scene(slug, meta, encounter, folders.get(encounter.zone)!._id, sort, casts.get(number) ?? [], previous.get(ids.scene(slug)));
  return { slug, doc };
});

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const f of folders.values()) writeFileSync(join(OUT, `folder-${slugify(f.name)}.json`), `${JSON.stringify(f, null, 2)}\n`);
for (const { slug, doc } of scenes) writeFileSync(join(OUT, `${slug}.json`), `${JSON.stringify(doc, null, 2)}\n`);
const tokens = scenes.reduce((n, { doc }) => n + doc.tokens.length, 0);
console.log(`scenes: ${scenes.length} scenes, ${tokens} tokens, ${folders.size} zone folders → packs/_source/${PACK}`);

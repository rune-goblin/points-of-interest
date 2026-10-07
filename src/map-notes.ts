import { adventureContent, importFolders } from './adventure';
import { MODULE_ID } from './constants';

type Source = Record<string, any>;
const REGION_HEX_SIZE = 275;
// A pointy-top hex's grid size is its flat-to-flat width. The icon spans the hex point to point, so
// the scrim scripts/build-map-icons.ts bakes into each icon covers the whole hex.
const ICON_SIZE = Math.round((REGION_HEX_SIZE * 2) / Math.sqrt(3));
const FONT_SIZE = 30;
const FALLBACK_ICON = 'icons/svg/book.svg';
// Releases up to 0.2.0 kept each site in its own entry beside this overview entry.
const LEGACY_OVERVIEW_ID = '9snGUfaEyJ38MwSg';
// Earlier releases gave each site's map note an image page; the encounter page shows it now.
const LEGACY_HANDOUT_ART = `modules/${MODULE_ID}/assets/map-notes/`;

interface SiteFlags {
  site: number;
  hex: string;
  icon?: string;
}

// The typedefs omit Note#controlIcon; these are the members the refresh hook touches.
interface DrawnNote {
  document: NoteDocument<Scene | null>;
  controlIcon: { bg: { visible: boolean }; border: { visible: boolean } };
  hover: boolean;
  controlled: boolean;
  isPreview: boolean;
  layer: { highlightObjects: boolean };
}

const t = (key: string, data?: Record<string, string>): string =>
  data ? game.i18n.format(`${MODULE_ID}.MapNotes.${key}`, data) : game.i18n.localize(`${MODULE_ID}.MapNotes.${key}`);

function siteFlags(doc: JournalEntry | JournalEntryPage<JournalEntry>): SiteFlags | undefined {
  return doc.flags[MODULE_ID] as unknown as SiteFlags | undefined;
}

// Hex keys follow the pf2e-kingmaker module's region map, which only lines up on its own grid.
function isRegionMap(scene: Scene): boolean {
  return scene.grid.type === CONST.GRID_TYPES.HEXODDR && scene.grid.size === REGION_HEX_SIZE;
}

// The Adventure's pages already link the world journal; the world copy keeps its ids so those links hold.
function toWorld(source: Source): JournalEntry['_source'] {
  return game.journal.fromCompendium(source as JournalEntry['_source'], { keepId: true, clearSort: false, clearOwnership: false });
}

async function upsertEmbedded(
  journal: JournalEntry,
  name: 'JournalEntryCategory' | 'JournalEntryPage',
  docs: ({ _id?: string | null } & Record<string, unknown>)[],
): Promise<void> {
  const existing = name === 'JournalEntryPage' ? journal.pages : journal.categories;
  const rows = docs.map(({ ownership: _ownership, _stats, ...doc }) => ({ ...doc, _id: doc._id! }));
  const updates = rows.filter((d) => existing.has(d._id));
  const additions = rows.filter((d) => !existing.has(d._id));
  if (updates.length) await journal.updateEmbeddedDocuments(name, updates);
  if (additions.length) await journal.createEmbeddedDocuments(name, additions, { keepId: true });
}

/**
 * Create the Points of Interest journal from the Adventure, or refresh the text, images, categories and flags
 * of the world copy. A new copy keeps the Adventure's ownership (None, which also hides its pins from
 * players); an existing copy keeps whatever ownership and folder the GM gave it. Entries
 * left from the one-entry-per-site layout and the old map-note image pages are deleted.
 */
export async function importJournal(): Promise<JournalEntry> {
  const [source] = (await adventureContent())?.journal ?? [];
  if (!source) throw new Error(t('NoPack'));
  const data = toWorld(source);
  let journal = game.journal.get(source._id);
  if (journal) {
    await upsertEmbedded(journal, 'JournalEntryCategory', data.categories);
    await upsertEmbedded(journal, 'JournalEntryPage', data.pages);
    await journal.update({ name: data.name, flags: data.flags });
    const handouts = journal.pages.filter((p) => p.type === 'image' && !!p.src?.startsWith(LEGACY_HANDOUT_ART));
    if (handouts.length) await journal.deleteEmbeddedDocuments('JournalEntryPage', handouts.map((p) => p.id));
  } else {
    await importFolders([source.folder]);
    journal = (await JournalEntry.create(data, { keepId: true })) as JournalEntry;
  }
  const legacy = game.journal.filter((e) => e.id === LEGACY_OVERVIEW_ID || siteFlags(e)?.site !== undefined);
  if (legacy.length) {
    await JournalEntry.deleteDocuments(legacy.map((e) => e.id));
    ui.notifications.info(t('Merged', { count: String(legacy.length), journal: journal.name }));
  }
  return journal;
}

const isSceneNote = (note: NoteDocument<Scene | null>): boolean => !!note.getFlag(MODULE_ID, 'scene');
const isSiteNote = (note: NoteDocument<Scene | null>): boolean => note.getFlag(MODULE_ID, 'site') !== undefined;

/**
 * Give each world copy of a module scene the journal note its Adventure version carries, and refresh the
 * link and label of one already there. The GM's placement of an existing note stays.
 */
async function syncSceneNotes(): Promise<number> {
  const sources = (await adventureContent())?.scenes ?? [];
  let created = 0;
  for (const source of sources) {
    const scene = game.scenes.get(source._id);
    const note = (source.notes as Source[]).find((n) => !!n.flags?.[MODULE_ID]?.scene);
    if (!scene || !note) continue;
    const existing = scene.notes.find(isSceneNote);
    if (existing) {
      await existing.update({ entryId: note.entryId, pageId: note.pageId, text: note.text });
    } else {
      await scene.createEmbeddedDocuments('Note', [note]);
      created++;
    }
  }
  return created;
}

// The viewed scene wins, so a GM with several copies of the region map picks one by opening it.
function findRegionMap(): Scene | null {
  if (canvas.scene && isRegionMap(canvas.scene)) return canvas.scene;
  const maps = game.scenes.filter(isRegionMap);
  if (maps.length === 1) return maps[0];
  ui.notifications.error(maps.length ? t('ManyScenes', { count: String(maps.length) }) : t('NoScene'));
  return null;
}

/**
 * Import the Points of Interest journal and give the world's copies of the module scenes their journal
 * notes, then mark each site's hex on the region map: the given scene, else the viewed one, else the
 * world's only region map.
 */
export async function placeMapNotes(target?: Scene): Promise<void> {
  if (!game.user.isGM) {
    ui.notifications.warn(t('GMOnly'));
    return;
  }
  if (target && !isRegionMap(target)) {
    ui.notifications.error(t('WrongScene', { scene: target.name }));
    return;
  }
  const scene = target ?? findRegionMap();
  if (!scene) return;
  const journal = await importJournal();
  const sceneNotes = await syncSceneNotes();
  if (sceneNotes) ui.notifications.info(t('SceneNotes', { count: String(sceneNotes) }));
  const count = await placeSites(scene, journal);
  ui.notifications.info(t('Placed', { count: String(count), scene: scene.name }));
}

/**
 * Lay each site's map-note art on its hex as a tile every player sees, under a pin that links the GM to
 * its page. Players can't see the pins while they hold no access to the journal. Re-running moves both
 * back to their hexes instead of duplicating them.
 */
async function placeSites(scene: Scene, journal: JournalEntry): Promise<number> {
  const pins = new Map<number, Source>();
  const tiles = new Map<number, Source>();
  for (const page of journal.pages) {
    const flags = siteFlags(page);
    if (!flags) continue;
    const [i, j] = flags.hex.split('.').map(Number);
    const { x, y } = scene.grid.getCenterPoint({ i, j });
    const texture = { src: flags.icon ?? FALLBACK_ICON };
    const site = { [MODULE_ID]: { site: flags.site } };
    pins.set(flags.site, {
      x, y, entryId: journal.id, pageId: page.id, text: page.name, texture, iconSize: ICON_SIZE, fontSize: FONT_SIZE, flags: site,
    });
    // v14 places a tile by its texture anchor, which defaults to its centre.
    tiles.set(flags.site, { name: page.name, x, y, width: ICON_SIZE, height: ICON_SIZE, texture, locked: true, flags: site });
  }
  await upsertSites(scene, 'Note', pins);
  await upsertSites(scene, 'Tile', tiles);
  return pins.size;
}

async function upsertSites(scene: Scene, name: 'Note' | 'Tile', sites: Map<number, Source>): Promise<void> {
  const docs: (NoteDocument<Scene> | TileDocument<Scene>)[] = name === 'Note' ? scene.notes.contents : scene.tiles.contents;
  const placed = new Map(docs.map((doc) => [doc.flags[MODULE_ID]?.site as number | undefined, doc.id] as const));
  const creates: Source[] = [];
  const updates: ({ _id: string } & Source)[] = [];
  for (const [site, data] of sites) {
    const id = placed.get(site);
    if (id) updates.push({ _id: id, ...data });
    else creates.push(data);
  }
  if (creates.length) await scene.createEmbeddedDocuments(name, creates);
  if (updates.length) await scene.updateEmbeddedDocuments(name, updates);
}

/**
 * Releases before the tiles gave players Limited on the journal so they could see the pins. Close the
 * journal, which hides the pins and the tactical scenes' notes from players, and lay the tiles under
 * the pins already placed.
 */
export async function tileSitePins(): Promise<void> {
  if (game.users.activeGM?.id !== game.user.id) return;
  const { LIMITED, NONE } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const journal = game.journal.find((entry) => entry.pages.some((page) => siteFlags(page)?.site !== undefined));
  if (journal?.ownership.default !== LIMITED) return;
  await journal.update({ 'ownership.default': NONE });
  for (const scene of game.scenes.filter((s) => s.notes.some(isSiteNote))) {
    await placeSites(scene, journal);
    ui.notifications.info(t('Tiled', { scene: scene.name }));
  }
}

// Each icon carries its own hex scrim, so Foundry's dark backing square and idle border would only
// box it in. The border still shows whenever Foundry would tint it.
function refreshSiteNote(note: DrawnNote): void {
  note.controlIcon.bg.visible = false;
  note.controlIcon.border.visible = note.hover || note.controlled || note.layer.highlightObjects || note.isPreview;
}

export function registerMapNoteHooks(): void {
  Hooks.on('refreshNote', (note: DrawnNote) => {
    if (isSiteNote(note.document)) refreshSiteNote(note);
  });
}

import { MODULE_ID } from './constants';

const JOURNAL_PACK = `${MODULE_ID}.journals`;
const REGION_HEX_SIZE = 275;
const ICON_SIZE = 160;
const FONT_SIZE = 30;
const FALLBACK_ICON = 'icons/svg/book.svg';

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

function siteFlags(entry: JournalEntry): SiteFlags | undefined {
  return entry.flags[MODULE_ID] as unknown as SiteFlags | undefined;
}

// Hex keys follow the Kingmaker module's region map, which only lines up on its own grid.
function isRegionMap(scene: Scene): boolean {
  return scene.grid.type === CONST.GRID_TYPES.HEXODDR && scene.grid.size === REGION_HEX_SIZE;
}

async function journalFolder(): Promise<Folder> {
  const existing = game.folders.find((f) => f.type === 'JournalEntry' && !!f.getFlag(MODULE_ID, 'journal'));
  if (existing) return existing;
  const created = await Folder.create({
    name: t('Folder'),
    type: 'JournalEntry',
    sorting: 'm',
    color: '#3b2a1a',
    flags: { [MODULE_ID]: { journal: true } },
  });
  return created as Folder;
}

// World copies keep the compendium ids, so links between entries can point at the world copies.
function toWorld(source: JournalEntry): JournalEntry['_source'] {
  const data = game.journal.fromCompendium(source, { keepId: true, clearSort: false, clearOwnership: false });
  const compendiumRef = `Compendium.${JOURNAL_PACK}.JournalEntry.`;
  for (const page of data.pages) {
    if (page.text?.content) page.text.content = page.text.content.replaceAll(compendiumRef, 'JournalEntry.');
  }
  return data;
}

/**
 * Create every pack entry missing from the world and refresh the text, images and flags of the ones
 * already there. New entries keep the pack's ownership (Limited for sites, so players see the map
 * note but can't open the entry); existing entries keep whatever ownership and folder the GM gave them.
 */
export async function importJournal(): Promise<JournalEntry[]> {
  const pack = game.packs.get(JOURNAL_PACK);
  if (!pack) throw new Error(t('NoPack'));
  const sources = (await pack.getDocuments()) as JournalEntry[];
  const folder = await journalFolder();
  const missing: JournalEntry['_source'][] = [];
  for (const source of sources) {
    const data = toWorld(source);
    const existing = game.journal.get(source.id);
    if (!existing) {
      missing.push({ ...data, folder: folder.id });
      continue;
    }
    const pages = data.pages.map(({ ownership: _ownership, _stats, ...page }) => ({ ...page, _id: page._id! }));
    const updates = pages.filter((p) => existing.pages.has(p._id));
    const additions = pages.filter((p) => !existing.pages.has(p._id));
    await existing.update({ name: data.name, flags: data.flags });
    await existing.updateEmbeddedDocuments('JournalEntryPage', updates);
    if (additions.length) await existing.createEmbeddedDocuments('JournalEntryPage', additions, { keepId: true });
  }
  if (missing.length) await JournalEntry.createDocuments(missing, { keepId: true });
  return sources.map((s) => game.journal.get(s.id)).filter((e): e is JournalEntry => !!e);
}

/**
 * Import the site journal entries, then pin each site's map note to its hex on the Stolen Lands
 * region map. Re-running moves existing notes back to their hexes instead of duplicating them.
 */
export async function placeMapNotes(scene: Scene | null = canvas.scene): Promise<void> {
  if (!game.user.isGM) {
    ui.notifications.warn(t('GMOnly'));
    return;
  }
  if (!scene || !isRegionMap(scene)) {
    ui.notifications.error(t('WrongScene'));
    return;
  }
  const entries = await importJournal();
  const placed = new Map(
    scene.notes.contents
      .map((note) => [note.getFlag(MODULE_ID, 'site') as number | undefined, note] as const)
      .filter((pair): pair is readonly [number, NoteDocument<Scene>] => pair[0] !== undefined),
  );
  const creates: Record<string, unknown>[] = [];
  const updates: ({ _id: string } & Record<string, unknown>)[] = [];
  for (const entry of entries) {
    const flags = siteFlags(entry);
    if (!flags) continue;
    const [i, j] = flags.hex.split('.').map(Number);
    const { x, y } = scene.grid.getCenterPoint({ i, j });
    const data = {
      x,
      y,
      // Linking the entry alone keeps the pin openable only at Observer; an image page link would let
      // Limited players open the handout.
      entryId: entry.id,
      pageId: null,
      text: entry.name,
      texture: { src: flags.icon ?? FALLBACK_ICON },
      iconSize: ICON_SIZE,
      fontSize: FONT_SIZE,
      flags: { [MODULE_ID]: { site: flags.site } },
    };
    const existing = placed.get(flags.site);
    if (existing) updates.push({ _id: existing.id, ...data });
    else creates.push(data);
  }
  if (creates.length) await scene.createEmbeddedDocuments('Note', creates);
  if (updates.length) await scene.updateEmbeddedDocuments('Note', updates);
  ui.notifications.info(t('Placed', { count: String(creates.length + updates.length), scene: scene.name }));
}

// The sketches carry their own parchment halo, so Foundry's dark backing square and idle border would
// only box them in. The border still shows whenever Foundry would tint it.
export function registerMapNoteHooks(): void {
  Hooks.on('refreshNote', (note: DrawnNote) => {
    if (note.document.getFlag(MODULE_ID, 'site') === undefined) return;
    note.controlIcon.bg.visible = false;
    note.controlIcon.border.visible = note.hover || note.controlled || note.layer.highlightObjects || note.isPreview;
  });
}

import { MODULE_ID } from './constants';

type Source = Record<string, any>;

/** The Adventure's documents as plain sources; the build already pointed their links at world ids. */
export interface AdventureContent {
  actors: Source[];
  scenes: Source[];
  journal: Source[];
  folders: Source[];
}

const adventurePack = () => game.packs.find((p) => p.metadata.packageName === MODULE_ID && p.metadata.type === 'Adventure');

let content: Promise<AdventureContent | undefined> | undefined;

/** Reads the module's Adventure once per session, for code that imports a piece of it on its own. */
export function adventureContent(): Promise<AdventureContent | undefined> {
  content ??= (async () => {
    const [adventure] = (await adventurePack()?.getDocuments()) ?? [];
    return adventure?.toObject() as AdventureContent | undefined;
  })();
  return content;
}

// Adventure install prompt. Wire it into an adventure module's `ready` hook; it's a no-op for a
// plain compendium module (no Adventure pack), so it self-deactivates. See README "Ship as an
// Adventure".

/**
 * If this module ships an Adventure pack and the GM hasn't imported it, open the importer once.
 * Gated by Foundry's own `core.adventureImports` record, so it prompts exactly once and never
 * re-nags. The pack and its UUID are discovered at runtime — nothing is hardcoded. Call on `ready`.
 */
export async function promptAdventureImport(): Promise<void> {
  if (!game.user.isGM) return;
  const adventure = (await adventurePack()?.getDocuments())?.[0] as { uuid: string; sheet?: { render: (o: object) => unknown } } | undefined;
  if (!adventure) return;
  const imported = game.settings.get('core', 'adventureImports') as Record<string, boolean> | undefined;
  if (imported?.[adventure.uuid]) return;
  void adventure.sheet?.render({ force: true });
}

/**
 * Open a journal entry the moment the import creates it (its id is preserved by keepId, so this
 * fires once — re-import updates rather than creates). Register on `init` with the intro journal's
 * id; pass nothing to skip.
 */
export function openJournalOnImport(journalId: string): void {
  Hooks.on('createJournalEntry', (entry: JournalEntry) => {
    if (game.user.isGM && entry.id === journalId) void entry.sheet?.render(true);
  });
}

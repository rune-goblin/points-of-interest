import { MODULE_ID } from '../constants';
import { hydrate, hydratedOf, lookup, recipeOf, requiredUuids, type Json } from './hydrate';

const ACTOR_PACK = `${MODULE_ID}.actors`;

type WorldActor = (typeof game.actors.contents)[number];
const DECLINED = 'declinedRebuild';

const t = (key: string, data?: Record<string, string>): string =>
  data ? game.i18n.format(`${MODULE_ID}.Actors.${key}`, data) : game.i18n.localize(`${MODULE_ID}.Actors.${key}`);

const actorPack = () => game.packs.get(ACTOR_PACK);
const sourceOf = (actor: WorldActor): Json => actor.toObject() as unknown as Json;
const needsHydration = (source: Json): boolean => !!recipeOf(source) && !hydratedOf(source);

/** One query per pack for every PF2e document the recipes read. */
async function fetchSources(stubs: Json[]): Promise<Map<string, Json>> {
  const byPack = new Map<string, Set<string>>();
  for (const uuid of stubs.flatMap((stub) => requiredUuids(recipeOf(stub)!))) {
    const [, scope, name, , id] = uuid.split('.');
    const collection = `${scope}.${name}`;
    if (!byPack.has(collection)) byPack.set(collection, new Set());
    byPack.get(collection)!.add(id);
  }
  const sources = new Map<string, Json>();
  for (const [collection, ids] of byPack) {
    const pack = game.packs.get(collection);
    if (!pack) continue;
    for (const doc of await pack.getDocuments({ _id__in: [...ids] })) {
      sources.set(`Compendium.${collection}.${pack.documentName}.${doc.id}`, doc.toObject() as unknown as Json);
    }
  }
  return sources;
}

/**
 * Hydrated copies of the given actor sources. One whose PF2e documents are missing comes back as the
 * stub, keeps our name and art, and is reported to the GM; a later world load retries it.
 */
export async function hydrateSources(sources: Json[]): Promise<Json[]> {
  const pending = sources.filter(needsHydration);
  if (!pending.length) return sources;
  const fetched = await fetchSources(pending);
  const env = { systemVersion: game.system.version, resolve: (uuid: string) => lookup(fetched, uuid) };
  const failed: string[] = [];
  const result = sources.map((source) => {
    if (!pending.includes(source)) return source;
    const { actor, warnings, error } = hydrate(source, env);
    for (const warning of warnings) console.warn(`${MODULE_ID} | ${warning}`);
    if (error) {
      console.error(`${MODULE_ID} | ${error}`);
      failed.push(source.name);
    }
    return actor;
  });
  if (failed.length) ui.notifications.error(t('Failed', { names: failed.join(', ') }), { permanent: true });
  return result;
}

// A full replace, the write an Adventure import makes, so the stat block's items swap in whole.
async function replace(sources: Json[]): Promise<number> {
  const ready = sources.filter((s) => hydratedOf(s));
  if (ready.length) await Actor.updateDocuments(ready as never[], { diff: false, recursive: false });
  return ready.length;
}

/** Hydrates world actors that still hold a stub, such as one dragged in from the compendium. */
export async function hydrateActors(actors: WorldActor[] = [...game.actors]): Promise<void> {
  const stubs = actors.map(sourceOf).filter(needsHydration);
  if (stubs.length) await replace(await hydrateSources(stubs));
}

/**
 * Imports actors from the module's pack under their own ids, hydrated, so scene tokens and later
 * drops find them. An actor keeps its pack folder when the world has it from the Adventure.
 */
export async function importActors(ids: string[]): Promise<WorldActor[]> {
  const missing = ids.filter((id) => !game.actors.has(id));
  const pack = actorPack();
  if (!missing.length || !pack) return [];
  const docs = (await pack.getDocuments({ _id__in: missing })) as WorldActor[];
  // The pack's ownership gives players Limited on loot, which PF2e needs to let them take from it.
  const data = docs.map((doc) => {
    const folder = doc._source.folder;
    return game.actors.fromCompendium(doc, { keepId: true, clearFolder: !(folder && game.folders.has(folder)), clearOwnership: false });
  });
  const hydrated = await hydrateSources(data as unknown as Json[]);
  return (await Actor.createDocuments(hydrated as never[], { keepId: true })) as WorldActor[];
}

// A stub's notes link its site page in the journal pack; a world that holds the journal gets links to its own copy.
function worldRefs(source: Json): Json {
  const json = JSON.stringify(source).replace(
    new RegExp(`Compendium\\.${MODULE_ID}\\.journals\\.JournalEntry\\.(\\w{16})`, 'g'),
    (ref, id: string) => (game.journal.has(id) ? `JournalEntry.${id}` : ref),
  );
  return JSON.parse(json) as Json;
}

/**
 * Rebuilds world actors from the module's stubs and the installed PF2e, matching them by slug. It
 * replaces the whole actor, play state included, and keeps only its id, folder, sort and ownership.
 */
export async function rebuildActors(actors?: WorldActor[]): Promise<number> {
  const pack = actorPack();
  if (!pack) return 0;
  const index = await pack.getIndex({ fields: [`flags.${MODULE_ID}.slug`] });
  const idBySlug = new Map(index.map((e) => [(e as Json).flags?.[MODULE_ID]?.slug as string, e._id]));
  const targets = (actors ?? [...game.actors]).filter((a) => idBySlug.has(a.getFlag(MODULE_ID, 'slug') as string));
  const stubs = new Map(
    ((await pack.getDocuments({ _id__in: [...new Set(targets.map((a) => idBySlug.get(a.getFlag(MODULE_ID, 'slug') as string)!))] })) as WorldActor[]).map(
      (doc) => [doc.id, sourceOf(doc)],
    ),
  );
  const sources = targets.map((actor) => {
    const stub = stubs.get(idBySlug.get(actor.getFlag(MODULE_ID, 'slug') as string)!)!;
    const keep = sourceOf(actor);
    return worldRefs({ ...stub, _id: actor.id, folder: keep.folder, sort: keep.sort, ownership: keep.ownership });
  });
  return replace(await hydrateSources(sources));
}

/** World actors built from an older recipe than the installed module's, with the current recipe's hash. */
async function outdatedActors(): Promise<{ actor: WorldActor; hash: string }[]> {
  const pack = actorPack();
  if (!pack) return [];
  const index = await pack.getIndex({ fields: [`flags.${MODULE_ID}.slug`, `flags.${MODULE_ID}.recipe.hash`] });
  const hashBySlug = new Map(index.map((e) => [(e as Json).flags?.[MODULE_ID]?.slug, (e as Json).flags?.[MODULE_ID]?.recipe?.hash]));
  return game.actors.contents.flatMap((actor) => {
    const built = hydratedOf(sourceOf(actor))?.hash;
    const hash = hashBySlug.get(actor.getFlag(MODULE_ID, 'slug'));
    return built && hash && built !== hash ? [{ actor, hash }] : [];
  });
}

/**
 * On world load the active GM hydrates any stub left in the world, then offers to rebuild actors an
 * updated module changed. A declined offer stays declined until the set of changed actors changes.
 */
export async function checkWorldActors(): Promise<void> {
  if (game.users.activeGM?.id !== game.user.id) return;
  await hydrateActors();
  const outdated = await outdatedActors();
  if (!outdated.length) return;
  const signature = outdated.map(({ actor, hash }) => `${actor.id}:${hash}`).sort().join();
  if (game.settings.get(MODULE_ID, DECLINED) === signature) return;
  const rebuild = await foundry.applications.api.DialogV2.confirm({
    window: { title: t('RebuildTitle') },
    content: `<p>${t('RebuildPrompt', { count: String(outdated.length), names: outdated.map(({ actor }) => actor.name).join(', ') })}</p>`,
  });
  if (!rebuild) {
    await game.settings.set(MODULE_ID, DECLINED, signature);
    return;
  }
  ui.notifications.info(t('Rebuilt', { count: String(await rebuildActors(outdated.map(({ actor }) => actor))) }));
}

let queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

// An import of many actors fires createActor once per actor; one batch hydrates them together.
function queue(actor: WorldActor): void {
  queued.add(actor.id);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const actors = [...queued].map((id) => game.actors.get(id)).filter((a): a is WorldActor => !!a);
    queued = new Set();
    void hydrateActors(actors);
  }, 100);
}

export function registerActorHooks(): void {
  game.settings.register(MODULE_ID, DECLINED, { name: DECLINED, scope: 'world', config: false, type: String, default: '' });

  // Adventure import creates and updates actors in one write each; hydrating first keeps it to that write.
  Hooks.on('preImportAdventure', (adventure: { collection?: { metadata: { packageName?: string } } }, options: { preImport: unknown[] }) => {
    if (adventure.collection?.metadata.packageName !== MODULE_ID) return;
    options.preImport.push(async (data: { toCreate: Record<string, Json[]>; toUpdate: Record<string, Json[]> }) => {
      for (const group of [data.toCreate, data.toUpdate]) if (group.Actor) group.Actor = await hydrateSources(group.Actor);
    });
  });

  // Any other way a stub reaches the world: a drag to the sidebar, a compendium import, a canvas drop.
  Hooks.on('createActor', (actor: WorldActor, _options: unknown, userId: string) => {
    if (userId === game.user.id && needsHydration(sourceOf(actor))) queue(actor);
  });

  // A token dropped from the journal or the pack reuses the world's copy of that actor, imported once under its own id.
  Hooks.on('dropCanvasData', (_canvas: unknown, data: { type?: string; uuid?: string; x: number; y: number }, event: DragEvent) => {
    const prefix = `Compendium.${ACTOR_PACK}.Actor.`;
    if (data.type !== 'Actor' || !data.uuid?.startsWith(prefix) || !game.user.isGM) return;
    const id = data.uuid.slice(prefix.length);
    if (game.actors.has(id)) {
      data.uuid = `Actor.${id}`;
      return;
    }
    void importActors([id]).then(() => canvas.tokens._onDropActorData(event, { type: 'Actor', uuid: `Actor.${id}`, x: data.x, y: data.y }));
    return false;
  });

  // Core opens a content link on the body's bubbling click, so capturing first lets a token link open the
  // world's hydrated copy instead of the pack's stub.
  document.body.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest<HTMLElement>(`a.poi-token[data-pack="${ACTOR_PACK}"]`);
      if (!link || !game.user.isGM) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = link.dataset.id!;
      void (async () => {
        const actor = game.actors.get(id) ?? (await importActors([id]))[0];
        void actor?.sheet.render(true);
      })();
    },
    true,
  );
}

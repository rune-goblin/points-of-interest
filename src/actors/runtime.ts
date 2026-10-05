import { adventureContent, importFolders } from '../adventure';
import { MODULE_ID } from '../constants';
import { hydrate, hydratedOf, lookup, recipeOf, requiredUuids, type Json } from './hydrate';

type WorldActor = (typeof game.actors.contents)[number];
const DECLINED = 'declinedRebuild';

const t = (key: string, data?: Record<string, string>): string =>
  data ? game.i18n.format(`${MODULE_ID}.Actors.${key}`, data) : game.i18n.localize(`${MODULE_ID}.Actors.${key}`);

const stubs = async (): Promise<Json[]> => (await adventureContent())?.actors ?? [];
const slugOf = (actor: Json | WorldActor): string | undefined =>
  'getFlag' in actor ? (actor.getFlag(MODULE_ID, 'slug') as string | undefined) : actor.flags?.[MODULE_ID]?.slug;
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
 * Imports actors from the module's Adventure under their own ids, hydrated and in their folders, so
 * scene tokens and journal links find them.
 */
export async function importActors(ids: string[]): Promise<WorldActor[]> {
  const missing = new Set(ids.filter((id) => !game.actors.has(id)));
  if (!missing.size) return [];
  const chosen = (await stubs()).filter((stub) => missing.has(stub._id));
  await importFolders(chosen.map((stub) => stub.folder));
  // The Adventure's ownership gives players Limited on loot, which PF2e needs to let them take from it.
  const data = chosen.map((stub) => game.actors.fromCompendium(stub as never, { keepId: true, clearOwnership: false }) as unknown as Json);
  if (!data.length) return [];
  return (await Actor.createDocuments((await hydrateSources(data)) as never[], { keepId: true })) as WorldActor[];
}

/**
 * Rebuilds world actors from the module's stubs and the installed PF2e, matching them by slug. It
 * replaces the whole actor, play state included, and keeps only its id, folder, sort and ownership.
 */
export async function rebuildActors(actors: WorldActor[] = [...game.actors]): Promise<number> {
  const bySlug = new Map((await stubs()).map((stub) => [slugOf(stub), stub]));
  const sources = actors.flatMap((actor) => {
    const stub = bySlug.get(slugOf(actor));
    if (!stub) return [];
    const keep = sourceOf(actor);
    return [{ ...structuredClone(stub), _id: actor.id, folder: keep.folder, sort: keep.sort, ownership: keep.ownership }];
  });
  return replace(await hydrateSources(sources));
}

/** World actors built from an older recipe than the installed module's, with the current recipe's hash. */
async function outdatedActors(): Promise<{ actor: WorldActor; hash: string }[]> {
  const hashBySlug = new Map((await stubs()).map((stub) => [slugOf(stub), recipeOf(stub)?.hash]));
  return game.actors.contents.flatMap((actor) => {
    const built = hydratedOf(sourceOf(actor))?.hash;
    const hash = hashBySlug.get(slugOf(actor));
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

  // Any other way a stub reaches the world, such as a copy of one whose hydration failed.
  Hooks.on('createActor', (actor: WorldActor, _options: unknown, userId: string) => {
    if (userId === game.user.id && needsHydration(sourceOf(actor))) queue(actor);
  });

  // The journal's token links name world actors. A token dragged from one whose actor the world lacks,
  // because the GM deleted it or imported only the journal, brings the actor in from the Adventure first.
  Hooks.on('dropCanvasData', (_canvas: unknown, data: { type?: string; uuid?: string; x: number; y: number }, event: DragEvent) => {
    const id = data.uuid?.startsWith('Actor.') ? data.uuid.slice('Actor.'.length) : undefined;
    if (data.type !== 'Actor' || !id || game.actors.has(id) || !game.user.isGM) return;
    void importActors([id]).then(([actor]) => actor && canvas.tokens._onDropActorData(event, { type: 'Actor', uuid: actor.uuid, x: data.x, y: data.y }));
    return false;
  });

  // Core opens a content link on the body's bubbling click, so capturing first lets a link to an actor
  // the world lacks import it before opening it.
  document.body.addEventListener(
    'click',
    (event) => {
      const id = (event.target as Element | null)?.closest<HTMLElement>('a.poi-token[data-id]')?.dataset.id;
      if (!id || game.actors.has(id) || !game.user.isGM) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void importActors([id]).then(([actor]) => actor?.sheet.render(true));
    },
    true,
  );
}

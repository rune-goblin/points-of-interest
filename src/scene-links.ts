import { adventureContent, importFolders } from './adventure';
import { FOE_KINDS, MODULE_ID } from './constants';
import { importActors } from './actors/runtime';
import { importJournal } from './map-notes';
import { MapLightbox } from './ui/MapLightbox';

type Source = Record<string, any>;

const t = (key: string, data?: Record<string, string>): string =>
  data ? game.i18n.format(`${MODULE_ID}.SceneLinks.${key}`, data) : game.i18n.localize(`${MODULE_ID}.SceneLinks.${key}`);

// Tokens name their actors by id, so a scene imported on its own brings its actors in under the same ids,
// and the journal its note opens, and the scene keeps its folder.
async function importScene(id: string): Promise<Scene | undefined> {
  const source = (await adventureContent())?.scenes.find((s) => s._id === id);
  if (!source) return undefined;
  const missing = [...new Set((source.tokens as Source[]).map((token) => token.actorId as string | null))].filter(
    (actorId): actorId is string => !!actorId && !game.actors.has(actorId),
  );
  await importActors(missing);
  const entryId = (source.notes as Source[]).find((note) => !!note.flags?.[MODULE_ID]?.scene)?.entryId;
  if (entryId && !game.journal.has(entryId)) await importJournal();
  await importFolders([source.folder]);
  const data = game.scenes.fromCompendium(source as never, { keepId: true });
  return (await Scene.create(data, { keepId: true })) as Scene | undefined;
}

async function viewScene(id: string): Promise<void> {
  const scene = game.scenes.get(id) ?? (await importScene(id));
  if (scene) await scene.view();
  else ui.notifications.error(t('Missing'));
}

const isFoe = (token: TokenDocument<Scene | null>): boolean =>
  FOE_KINDS.has((game.actors.get(token.actorId ?? '')?.getFlag(MODULE_ID, 'kind') as string | undefined) ?? '');

/**
 * Scenes imported from earlier releases have token vision on, which hides the map from a player without
 * a token on it, and their creatures and hazards in view. Hide those tokens, then turn token vision off,
 * once per scene; the flag keeps a GM's later choices. A scene with a fight under way keeps its tokens
 * as the GM has them.
 */
export async function showWholeMaps(): Promise<void> {
  if (game.users.activeGM?.id !== game.user.id) return;
  const scenes = game.scenes.filter(
    (scene) => scene.getFlag(MODULE_ID, 'encounter') !== undefined && scene.getFlag(MODULE_ID, 'tokenVision') === undefined,
  );
  if (!scenes.length) return;
  const opened = scenes.filter((scene) => scene.tokenVision).length;
  const fighting = new Set(game.combats.filter((combat) => combat.started).map((combat) => combat.scene?.id));
  let hidden = 0;
  for (const scene of scenes) {
    if (fighting.has(scene.id)) continue;
    const foes = scene.tokens.filter((token) => !token.hidden && isFoe(token));
    if (foes.length) await scene.updateEmbeddedDocuments('Token', foes.map((token) => ({ _id: token.id, hidden: true })));
    hidden += foes.length;
  }
  await Scene.updateDocuments(scenes.map((scene) => ({ _id: scene.id, tokenVision: false, [`flags.${MODULE_ID}.tokenVision`]: false })));
  if (opened || hidden) ui.notifications.info(t('WholeMaps', { count: String(scenes.length), hidden: String(hidden) }));
}

// Scene names such as "The Unmaker" give the foe away, so the popout hides its title. The GM's copy
// matches, so sharing again from its Show Players control reveals nothing more.
function showPlayers(src: string, title: string): void {
  const popout = new foundry.applications.apps.ImagePopout({ src, window: { title }, showTitle: false });
  void popout.render({ force: true });
  popout.shareImage();
}

/**
 * Show to players shares the establishing art in Foundry's image popout. Show map expands the tactical
 * map. Open scene views the scene, importing it and its actors when necessary. Legacy cards retain their
 * original actions.
 */
export function registerSceneLinks(): void {
  document.body.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    // World journals refreshed before the banner went inert still link it to its art, which would
    // navigate away from the game.
    if (target?.closest('a.poi-scene-art')) {
      event.preventDefault();
      return;
    }
    const share = target?.closest<HTMLElement>('.poi-show-players[data-image]');
    if (share) {
      event.preventDefault();
      if (game.user.isGM) showPlayers(share.dataset.image!, share.dataset.caption ?? '');
      return;
    }
    const zoom = target?.closest<HTMLElement>('.poi-show-map[data-map], .poi-zoom[data-map]');
    if (zoom) {
      event.preventDefault();
      MapLightbox.open(zoom.dataset.map!, zoom.dataset.caption ?? '');
      return;
    }
    const link = target?.closest<HTMLElement>('.poi-open-scene[data-scene], a.poi-scene[data-scene]');
    if (!link) return;
    event.preventDefault();
    if (!game.user.isGM) return;
    void viewScene(link.dataset.scene!);
  });
}

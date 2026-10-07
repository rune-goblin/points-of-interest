import { adventureContent, importFolders } from './adventure';
import { MODULE_ID } from './constants';
import { importActors } from './actors/runtime';
import { importJournal } from './map-notes';
import { MapLightbox } from './ui/MapLightbox';

type Source = Record<string, any>;

const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.SceneLinks.${key}`);

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

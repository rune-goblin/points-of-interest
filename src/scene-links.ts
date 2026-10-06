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

/**
 * Banners expand the establishing art. Show map expands the tactical map. Open scene views the
 * scene, importing it and its actors when necessary. Legacy cards retain their original actions.
 */
export function registerSceneLinks(): void {
  document.body.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const art = target?.closest<HTMLElement>('.poi-scene-art[data-image]');
    if (art) {
      event.preventDefault();
      MapLightbox.open(art.dataset.image!, art.dataset.caption ?? '');
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

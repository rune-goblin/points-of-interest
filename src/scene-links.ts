import { adventureContent } from './adventure';
import { MODULE_ID } from './constants';
import { importActors } from './actors/runtime';
import { importJournal } from './map-notes';

type Source = Record<string, any>;

const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.SceneLinks.${key}`);

// Tokens name their actors by id, so a scene imported on its own brings its actors in under the same ids,
// and the journal its note opens. It keeps its zone folder when the world has that from the Adventure.
async function importScene(id: string): Promise<Scene | undefined> {
  const source = (await adventureContent())?.scenes.find((s) => s._id === id);
  if (!source) return undefined;
  const missing = [...new Set((source.tokens as Source[]).map((token) => token.actorId as string | null))].filter(
    (actorId): actorId is string => !!actorId && !game.actors.has(actorId),
  );
  await importActors(missing);
  const entryId = (source.notes as Source[]).find((note) => !!note.flags?.[MODULE_ID]?.scene)?.entryId;
  if (entryId && !game.journal.has(entryId)) await importJournal();
  const folder = source.folder as string | null;
  const data = game.scenes.fromCompendium(source as never, { keepId: true, clearFolder: !(folder && game.folders.has(folder)) });
  return (await Scene.create(data, { keepId: true })) as Scene | undefined;
}

async function viewScene(id: string): Promise<void> {
  const scene = game.scenes.get(id) ?? (await importScene(id));
  if (scene) await scene.view();
  else ui.notifications.error(t('Missing'));
}

/**
 * Scene cards on the site pages (`a.poi-scene[data-scene]`) view their scene, importing it and its
 * actors from the module's Adventure when the world has no copy yet.
 */
export function registerSceneLinks(): void {
  document.body.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest<HTMLElement>('a.poi-scene[data-scene]');
    if (!link || !game.user.isGM) return;
    event.preventDefault();
    void viewScene(link.dataset.scene!);
  });
}

import './styles.css';
import { MODULE_ID } from './constants';
import { promptAdventureImport } from './adventure';
import { importJournal, placeMapNotes, registerMapNoteHooks } from './map-notes';
import { registerSceneLinks } from './scene-links';

interface ModuleApi {
  version: string;
  importJournal: typeof importJournal;
  placeMapNotes: typeof placeMapNotes;
}

Hooks.once('init', () => {
  registerMapNoteHooks();
  registerSceneLinks();
  console.log(`${MODULE_ID} | init`);
});

Hooks.once('ready', () => {
  const module = game.modules.get(MODULE_ID);
  const version = module?.version ?? '0.0.0';
  const api: ModuleApi = { version, importJournal, placeMapNotes };
  // `api` is the Foundry convention for a public API, but isn't a typed field on Module.
  if (module) (module as { api?: ModuleApi }).api = api;
  console.log(`${MODULE_ID} | ready (v${version})`);
  void promptAdventureImport();
});

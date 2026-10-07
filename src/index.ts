import './styles.css';
import { MODULE_ID } from './constants';
import { promptAdventureImport } from './adventure';
import { checkWorldActors, hydrateActors, rebuildActors, registerActorHooks } from './actors/runtime';
import { importJournal, placeMapNotes, registerMapNoteHooks, tileSitePins } from './map-notes';
import { registerRevealHooks } from './reveals';
import { registerSceneLinks } from './scene-links';
import { registerRevealPanel } from './ui/RevealPanel';

interface ModuleApi {
  version: string;
  importJournal: typeof importJournal;
  placeMapNotes: typeof placeMapNotes;
  hydrateActors: typeof hydrateActors;
  rebuildActors: typeof rebuildActors;
}

Hooks.once('init', () => {
  registerMapNoteHooks();
  registerSceneLinks();
  registerActorHooks();
  registerRevealHooks();
  registerRevealPanel();
  console.log(`${MODULE_ID} | init`);
});

Hooks.once('ready', () => {
  const module = game.modules.get(MODULE_ID);
  const version = module?.version ?? '0.0.0';
  const api: ModuleApi = { version, importJournal, placeMapNotes, hydrateActors, rebuildActors };
  // `api` is the Foundry convention for a public API, but isn't a typed field on Module.
  if (module) (module as { api?: ModuleApi }).api = api;
  console.log(`${MODULE_ID} | ready (v${version})`);
  void promptAdventureImport();
  void checkWorldActors();
  void tileSitePins();
});

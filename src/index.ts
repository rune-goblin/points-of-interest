import './styles.css';
import { MODULE_ID } from './constants';

interface ModuleApi {
  version: string;
}

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | init`);
});

Hooks.once('ready', () => {
  const module = game.modules.get(MODULE_ID);
  const version = module?.version ?? '0.0.0';
  const api: ModuleApi = { version };
  // `api` is the Foundry convention for a public API, but isn't a typed field on Module.
  if (module) (module as { api?: ModuleApi }).api = api;
  console.log(`${MODULE_ID} | ready (v${version})`);
});

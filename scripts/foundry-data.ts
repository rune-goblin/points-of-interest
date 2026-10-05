import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG = join(process.cwd(), '.dev-paths.json');

// Same resolution order as scripts/setup.ts: env override, cached dev path, then the
// per-platform defaults (v14's versioned folder first, then a plain install).
export function detectFoundryData(): string | undefined {
  if (process.env.FOUNDRY_DATA) return process.env.FOUNDRY_DATA;
  if (existsSync(CONFIG)) {
    try {
      const { foundryData } = JSON.parse(readFileSync(CONFIG, 'utf8')) as { foundryData?: string };
      if (foundryData && existsSync(foundryData)) return foundryData;
    } catch {
      /* malformed cache — fall through to detection */
    }
  }
  let base: string;
  if (process.platform === 'darwin') base = join(homedir(), 'Library/Application Support');
  else if (process.platform === 'win32') base = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local');
  else base = process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share');
  for (const name of ['FoundryVTT-v14', 'FoundryVTT']) {
    const dd = join(base, name, 'Data');
    if (existsSync(dd)) return dd;
  }
  return undefined;
}

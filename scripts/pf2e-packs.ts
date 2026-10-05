// Reads PF2e system compendia into memory, keyed by the UUIDs recipes use.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

type Json = Record<string, any>;

const CANDIDATES = [
  join(process.cwd(), '_foundry-data', 'systems', 'pf2e'),
  join(homedir(), 'Library', 'Application Support', 'FoundryVTT', 'Data', 'systems', 'pf2e'),
  join(homedir(), '.local', 'share', 'FoundryVTT', 'Data', 'systems', 'pf2e'),
];

/** `--system <dir>`, then $PF2E_SYSTEM, then the usual install locations. */
export function findSystem(argv: string[] = process.argv): string | undefined {
  const i = argv.indexOf('--system');
  const given = i > 0 ? argv[i + 1] : process.env.PF2E_SYSTEM;
  const dirs = given ? [given] : CANDIDATES;
  return dirs.find((dir) => existsSync(join(dir, 'packs')) && existsSync(join(dir, 'system.json')));
}

export function systemVersion(system: string): string {
  return (JSON.parse(readFileSync(join(system, 'system.json'), 'utf8')) as { version: string }).version;
}

// Foundry holds a LOCK on packs it has open, so read copies instead of the live LevelDB.
export function loadPacks(system: string, packs: string[]): Map<string, Json> {
  const manifest = JSON.parse(readFileSync(join(system, 'system.json'), 'utf8')) as { packs: { name: string; path: string; type: string }[] };
  const tmp = mkdtempSync(join(tmpdir(), 'poi-pf2e-'));
  const fvtt = join(process.cwd(), 'node_modules', '.bin', 'fvtt');
  const docs = new Map<string, Json>();
  try {
    for (const name of packs) {
      const pack = manifest.packs.find((p) => p.name === name);
      if (!pack) throw new Error(`PF2e has no pack named ${name}`);
      const folder = pack.path.split('/').pop()!;
      const ldb = join(tmp, 'ldb', folder);
      cpSync(join(system, pack.path), ldb, { recursive: true });
      rmSync(join(ldb, 'LOCK'), { force: true });
      const json = join(tmp, 'json', folder);
      execFileSync(fvtt, ['package', 'unpack', folder, '--in', join(tmp, 'ldb'), '--out', json], { stdio: 'ignore' });
      for (const file of readdirSync(json)) {
        const doc = JSON.parse(readFileSync(join(json, file), 'utf8')) as Json;
        if (/^!(actors|items)!/.test(doc._key ?? '')) docs.set(`Compendium.pf2e.${name}.${pack.type}.${doc._id}`, doc);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return docs;
}

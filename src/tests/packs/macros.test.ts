import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

interface StableId { ids: { macro(slug: string): string } }
// Loaded at runtime: tsconfig.json's rootDir is src/, so a static import of scripts/ fails `npm run check`.
const { ids } = (await import(/* @vite-ignore */ join(ROOT, 'scripts', 'stable-id.ts'))) as StableId;
const SOURCE = join(ROOT, 'packs', '_source', 'macros');

interface MacroSource { _id: string; _key: string; type: string; command: string }

interface FolderSource { _id: string; _key: string; name: string; type: string; folder: string | null }

const sources = readdirSync(SOURCE)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ slug: f.replace(/\.json$/, ''), doc: JSON.parse(readFileSync(join(SOURCE, f), 'utf8')) as MacroSource & { folder: string | null } }));
const macros = sources.filter((s) => s.doc._key.startsWith('!macros!'));
const folders = sources.filter((s) => s.doc._key.startsWith('!folders!')).map((s) => s.doc as unknown as FolderSource);
const apiMembers = [...readFileSync(join(ROOT, 'src', 'index.ts'), 'utf8').matchAll(/^\s+(\w+): typeof \w+;$/gm)].map((m) => m[1]);
const AsyncFunction = (async () => {}).constructor as new (body: string) => unknown;

describe('macros pack sources', () => {
  it('ships the map-notes macro', () => {
    expect(macros.map((m) => m.slug)).toContain('place-map-notes');
  });

  it('keys each macro by the stable id of its file name', () => {
    for (const { slug, doc } of macros) {
      expect(doc._id).toBe(ids.macro(slug));
      expect(doc._key).toBe(`!macros!${doc._id}`);
    }
  });

  it('compiles each script as a Foundry macro body', () => {
    for (const { doc } of macros) {
      expect(doc.type).toBe('script');
      expect(() => new AsyncFunction(doc.command)).not.toThrow();
    }
  });

  it('files every macro in one Points of Interest folder', () => {
    expect(folders.map((f) => [f.name, f.type, f.folder])).toEqual([['Points of Interest', 'Macro', null]]);
    for (const { doc } of macros) expect(doc.folder).toBe(folders[0]._id);
  });

  it('calls only functions the module API exposes', () => {
    for (const { doc } of macros) {
      const calls = [...doc.command.matchAll(/\bapi\.(\w+)\(/g)].map((m) => m[1]);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(apiMembers).toContain(call);
    }
  });
});

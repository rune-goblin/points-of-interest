import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

interface StableId {
  MODULE_ID: string;
  slugify(heading: string): string;
  ids: { siteJournal(slug: string): string; encounterPage(slug: string): string; scene(mapSlug: string): string };
}
// Loaded at runtime: tsconfig.json's rootDir is src/, so a static import of scripts/ fails `npm run check`.
const { MODULE_ID, ids, slugify } = (await import(/* @vite-ignore */ join(ROOT, 'scripts', 'stable-id.ts'))) as StableId;
const SOURCE = join(ROOT, 'packs', '_source', 'scenes');
const SERVED = `modules/${MODULE_ID}/`;

interface Level { _id: string; _key: string; background: { src: string } }
interface SceneSource {
  _id: string;
  _key: string;
  name: string;
  thumb: string;
  initialLevel: string;
  levels: Level[];
  journal: string;
  journalEntryPage: string;
  folder: string | null;
  flags: Record<string, { encounter?: number }>;
}
interface FolderSource { _id: string; _key: string; type: string }

const docs = readdirSync(SOURCE).map((f) => JSON.parse(readFileSync(join(SOURCE, f), 'utf8')) as { _id: string; _key: string });
const scenes = docs.filter((d) => d._key.startsWith('!scenes!')) as unknown as SceneSource[];
const folders = docs.filter((d) => d._key.startsWith('!folders!')) as unknown as FolderSource[];

const servedFile = (path: string) => join(ROOT, path.slice(SERVED.length));

const headings = new Map(
  [...readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8').matchAll(/^### (\d+)\. (.+)$/gm)].map((m) => [Number(m[1]), `${m[1]}. ${m[2].trim()}`]),
);

describe('scenes pack source', () => {
  it('has one scene per tactical map, keyed by the stable id', () => {
    const maps = readdirSync(join(ROOT, 'assets', 'maps')).filter((f) => f.endsWith('.webp'));
    expect(scenes).toHaveLength(maps.length);
    for (const map of maps) {
      const id = ids.scene(map.replace(/\.webp$/, ''));
      expect(scenes.find((s) => s._id === id), map).toBeDefined();
    }
  });

  it('gives every document a unique id and a matching _key', () => {
    const allIds = docs.map((d) => d._id);
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const s of scenes) expect(s._key).toBe(`!scenes!${s._id}`);
    for (const f of folders) {
      expect(f._key).toBe(`!folders!${f._id}`);
      expect(f.type).toBe('Scene');
    }
  });

  it('puts the map on a single initial level and the thumbnail beside it', () => {
    for (const s of scenes) {
      expect(s.levels, s.name).toHaveLength(1);
      const [level] = s.levels;
      expect(level._key).toBe(`!scenes.levels!${s._id}.${level._id}`);
      expect(s.initialLevel).toBe(level._id);
      for (const path of [level.background.src, s.thumb]) {
        expect(path.startsWith(`${SERVED}assets/`), path).toBe(true);
        expect(existsSync(servedFile(path)), path).toBe(true);
      }
    }
  });

  it('links each scene to its encounter page and a zone folder', () => {
    const folderIds = new Set(folders.map((f) => f._id));
    for (const s of scenes) {
      const encounter = s.flags[MODULE_ID]?.encounter;
      const heading = headings.get(encounter ?? NaN);
      expect(heading, s.name).toBeDefined();
      expect(s.journal).toBe(ids.siteJournal(slugify(heading!)));
      expect(s.journalEntryPage).toBe(ids.encounterPage(slugify(heading!)));
      expect(folderIds.has(s.folder ?? ''), s.name).toBe(true);
    }
  });
});

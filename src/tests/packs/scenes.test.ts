import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

interface StableId {
  MODULE_ID: string;
  slugify(heading: string): string;
  ids: { journal(): string; encounterPage(slug: string): string; scene(mapSlug: string): string };
}
// Loaded at runtime: tsconfig.json's rootDir is src/, so a static import of scripts/ fails `npm run check`.
const { MODULE_ID, ids, slugify } = (await import(/* @vite-ignore */ join(ROOT, 'scripts', 'stable-id.ts'))) as StableId;
const SOURCE = join(ROOT, 'packs', '_source', 'scenes');
const SERVED = `modules/${MODULE_ID}/`;

interface Level { _id: string; _key: string; background: { src: string } }
interface Note { _id: string; _key: string; entryId: string; pageId: string; x: number; y: number; iconSize: number; flags: Record<string, { scene?: boolean }> }
interface Token { _id: string; _key: string; actorId: string; level: string; x: number; y: number; width: number; height: number }
interface Tile { _id: string; _key: string; texture: { src: string; anchorX: number; anchorY: number }; x: number; y: number; width: number; height: number; hidden: boolean; flags: Record<string, { reveal?: string }> }
interface SceneSource {
  _id: string;
  _key: string;
  name: string;
  thumb: string;
  initialLevel: string;
  width: number;
  height: number;
  padding: number;
  grid: { size: number };
  levels: Level[];
  tokens: Token[];
  notes: Note[];
  tiles: Tile[];
  journal: string;
  journalEntryPage: string;
  folder: string | null;
  flags: Record<string, { encounter?: number }>;
}
interface FolderSource { _id: string; _key: string; type: string; name: string; folder: string | null }

const docs = readdirSync(SOURCE).map((f) => JSON.parse(readFileSync(join(SOURCE, f), 'utf8')) as { _id: string; _key: string });
const scenes = docs.filter((d) => d._key.startsWith('!scenes!')) as unknown as SceneSource[];
const folders = docs.filter((d) => d._key.startsWith('!folders!')) as unknown as FolderSource[];

const servedFile = (path: string) => join(ROOT, path.slice(SERVED.length));

const ACTORS = join(ROOT, 'packs', '_source', 'actors');
const actors = readdirSync(ACTORS)
  .map((f) => JSON.parse(readFileSync(join(ACTORS, f), 'utf8')) as { _id: string; _key: string; name: string; type: string; flags: Record<string, { encounter?: number }> })
  .filter((d) => d._key.startsWith('!actors!'));
const actorIds = new Set(actors.map((d) => d._id));

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

  it('places tokens of packed actors on the map, on the scene\'s level', () => {
    for (const s of scenes) {
      const g = s.grid.size;
      const pad = { x: Math.ceil((s.padding * s.width) / g) * g, y: Math.ceil((s.padding * s.height) / g) * g };
      for (const t of s.tokens) {
        expect(t._key, s.name).toBe(`!scenes.tokens!${s._id}.${t._id}`);
        expect(actorIds.has(t.actorId), `${s.name}: ${t._id}`).toBe(true);
        expect(t.level).toBe(s.initialLevel);
        expect(t.x >= pad.x && t.x + t.width * g <= pad.x + s.width, `${s.name}: ${t._id} x`).toBe(true);
        expect(t.y >= pad.y && t.y + t.height * g <= pad.y + s.height, `${s.name}: ${t._id} y`).toBe(true);
      }
    }
    expect(scenes.every((s) => s.tokens.length > 0)).toBe(true);
  });

  it('puts every loot actor on a map of its encounter', () => {
    const unplaced = actors.filter(
      (a) =>
        a.type === 'loot' &&
        !scenes.some((s) => s.flags[MODULE_ID]?.encounter === a.flags[MODULE_ID]?.encounter && s.tokens.some((t) => t.actorId === a._id)),
    );
    expect(unplaced.map((a) => a.name)).toEqual([]);
  });

  it('pins a note to its encounter page in the top-left square of the map', () => {
    for (const s of scenes) {
      const heading = headings.get(s.flags[MODULE_ID]?.encounter ?? NaN)!;
      const notes = s.notes.filter((n) => n.flags[MODULE_ID]?.scene);
      expect(notes, s.name).toHaveLength(1);
      const [note] = notes;
      expect(note._key).toBe(`!scenes.notes!${s._id}.${note._id}`);
      expect(note.entryId).toBe(ids.journal());
      expect(note.pageId).toBe(ids.encounterPage(slugify(heading)));
      const g = s.grid.size;
      const pad = { x: Math.ceil((s.padding * s.width) / g) * g, y: Math.ceil((s.padding * s.height) / g) * g };
      const corner = Math.max(g, note.iconSize);
      expect(note.x - pad.x, s.name).toBeGreaterThanOrEqual(note.iconSize / 2);
      expect(note.x - pad.x, s.name).toBeLessThanOrEqual(corner);
      expect(note.y - pad.y, s.name).toBeGreaterThanOrEqual(note.iconSize / 2);
      expect(note.y - pad.y, s.name).toBeLessThanOrEqual(corner);
    }
  });

  it('hides each reveal tile on the map until a token of its scene wakes it', () => {
    const reveals = scenes.flatMap((s) => s.tiles.filter((t) => t.flags[MODULE_ID]?.reveal).map((t) => ({ s, t })));
    expect(reveals.length).toBeGreaterThan(0);
    for (const { s, t } of reveals) {
      const g = s.grid.size;
      const pad = { x: Math.ceil((s.padding * s.width) / g) * g, y: Math.ceil((s.padding * s.height) / g) * g };
      expect(t._key).toBe(`!scenes.tiles!${s._id}.${t._id}`);
      expect(existsSync(servedFile(t.texture.src)), t.texture.src).toBe(true);
      expect(t.hidden, s.name).toBe(true);
      const left = t.x - t.width * t.texture.anchorX;
      const top = t.y - t.height * t.texture.anchorY;
      expect(left >= pad.x && left + t.width <= pad.x + s.width, `${s.name}: tile x`).toBe(true);
      expect(top >= pad.y && top + t.height <= pad.y + s.height, `${s.name}: tile y`).toBe(true);
      expect(s.tokens.some((k) => k.actorId === t.flags[MODULE_ID].reveal), s.name).toBe(true);
    }
  });

  it('links each scene to its encounter page and files it in one Points of Interest folder', () => {
    expect(folders.map((f) => [f.name, f.type, f.folder])).toEqual([['Points of Interest', 'Scene', null]]);
    for (const s of scenes) {
      const encounter = s.flags[MODULE_ID]?.encounter;
      const heading = headings.get(encounter ?? NaN);
      expect(heading, s.name).toBeDefined();
      expect(s.journal).toBe(ids.journal());
      expect(s.journalEntryPage).toBe(ids.encounterPage(slugify(heading!)));
      expect(s.folder, s.name).toBe(folders[0]._id);
    }
  });
});

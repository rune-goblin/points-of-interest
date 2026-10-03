import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MODULE_ID = 'points-of-interest';
const SERVED = `modules/${MODULE_ID}/`;

interface Doc { _id: string; _key: string; name: string }
interface Item extends Doc { type: string }
interface ActorSource extends Doc {
  type: string;
  img: string;
  folder: string | null;
  items: Item[];
  prototypeToken: { name: string; texture: { src: string } };
  flags: Record<string, { encounter?: number }>;
  system: { details: { privateNotes?: string; description?: string } };
}

const readDir = <T>(dir: string): T[] =>
  readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T);

const docs = readDir<Doc>(join(ROOT, 'packs', '_source', 'actors'));
const actors = docs.filter((d) => d._key.startsWith('!actors!')) as ActorSource[];
const folders = docs.filter((d) => d._key.startsWith('!folders!'));

const journals = readDir<{ _id: string; pages: Doc[] }>(join(ROOT, 'packs', '_source', 'journals'));
const pageUuids = new Set(
  journals.flatMap((j) => j.pages.map((p) => `Compendium.${MODULE_ID}.journals.JournalEntry.${j._id}.JournalEntryPage.${p._id}`)),
);

const servedFile = (path: string): string => join(ROOT, path.slice(SERVED.length));

describe('actors pack sources', () => {
  it('has one actor per portrait, a second Ilthuliak token, and the two hazards', () => {
    expect(actors).toHaveLength(86);
    const portraits = readdirSync(join(ROOT, 'assets', 'portraits')).map((f) => `${SERVED}assets/portraits/${f}`);
    const used = new Set(actors.map((a) => a.img));
    expect(portraits.filter((p) => !used.has(p))).toEqual([]);
  });

  it('gives every document a unique id and a key matching it', () => {
    const allIds = docs.map((d) => d._id);
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const actor of actors) {
      expect(actor._key).toBe(`!actors!${actor._id}`);
      for (const item of actor.items) expect(item._key).toBe(`!actors.items!${actor._id}.${item._id}`);
      expect(new Set(actor.items.map((i) => i._id)).size).toBe(actor.items.length);
    }
    for (const folder of folders) expect(folder._key).toBe(`!folders!${folder._id}`);
  });

  it('points every image and token at a served file that exists', () => {
    for (const actor of actors) {
      for (const path of [actor.img, actor.prototypeToken.texture.src]) {
        expect(path.startsWith(`${SERVED}assets/`), `${actor.name}: ${path}`).toBe(true);
        expect(existsSync(servedFile(path)), `${actor.name}: ${path}`).toBe(true);
      }
    }
  });

  it('files every actor under its encounter folder', () => {
    const folderIds = new Set(folders.map((f) => f._id));
    expect(folders).toHaveLength(21);
    for (const actor of actors) {
      const encounter = actor.flags[MODULE_ID]?.encounter;
      expect(encounter, actor.name).toBeGreaterThanOrEqual(1);
      expect(encounter, actor.name).toBeLessThanOrEqual(21);
      expect(folderIds.has(actor.folder ?? ''), actor.name).toBe(true);
    }
  });

  it('links each actor to an encounter page that exists in the journal pack', () => {
    for (const actor of actors) {
      const notes = actor.system.details.privateNotes ?? actor.system.details.description ?? '';
      const links = [...notes.matchAll(/@UUID\[(Compendium\.points-of-interest\.journals\.[^\]]+)\]/g)].map((m) => m[1]);
      expect(links.length, actor.name).toBeGreaterThan(0);
      for (const uuid of links) expect(pageUuids.has(uuid), `${actor.name}: ${uuid}`).toBe(true);
    }
  });
});

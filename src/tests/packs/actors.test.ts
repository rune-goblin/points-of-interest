import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { requiredUuids, type Recipe } from '../../actors/hydrate';

const ROOT = process.cwd();
const MODULE_ID = 'points-of-interest';
const SERVED = `modules/${MODULE_ID}/`;
const PF2E_UUID = /^Compendium\.pf2e\.[\w-]+\.(Actor|Item)\.\w{16}(\.Item\.\w{16})?$/;

interface Doc { _id: string; _key: string; name: string }
interface Item extends Doc {
  type: string;
  _stats?: { compendiumSource?: string | null };
  system: { publication?: { title?: string }; spell?: unknown };
}
interface ActorSource extends Doc {
  type: string;
  img: string;
  folder: string | null;
  ownership: { default: number };
  items: Item[];
  effects: unknown[];
  prototypeToken: { name: string; texture: { src: string } };
  flags: Record<string, { encounter?: number; kind?: string; recipe?: Recipe }>;
  system: Record<string, Record<string, unknown>> & { details: { privateNotes?: string; description?: string } };
}

const readDir = <T>(dir: string): T[] =>
  readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T);

const docs = readDir<Doc>(join(ROOT, 'packs', '_source', 'actors'));
const actors = docs.filter((d) => d._key.startsWith('!actors!')) as ActorSource[];
const folders = docs.filter((d) => d._key.startsWith('!folders!'));
const isCache = (actor: ActorSource): boolean => actor.flags[MODULE_ID]?.kind === 'cache';
const recipeOf = (actor: ActorSource): Recipe | undefined => actor.flags[MODULE_ID]?.recipe;

const journals = readDir<{ _id: string; pages: Doc[] }>(join(ROOT, 'packs', '_source', 'journals'));
const pageUuids = new Set(
  journals.flatMap((j) => j.pages.map((p) => `Compendium.${MODULE_ID}.journals.JournalEntry.${j._id}.JournalEntryPage.${p._id}`)),
);

const servedFile = (path: string): string => join(ROOT, path.slice(SERVED.length));

describe('actors pack sources', () => {
  it('has one actor per portrait, a second black dragon token, the two hazards and the treasure caches', () => {
    expect(actors.filter((a) => !isCache(a))).toHaveLength(86);
    expect(actors.filter(isCache)).toHaveLength(16);
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
    for (const actor of actors.filter((a) => !isCache(a))) {
      for (const path of [actor.img, actor.prototypeToken.texture.src]) {
        expect(path.startsWith(`${SERVED}assets/`), `${actor.name}: ${path}`).toBe(true);
        expect(existsSync(servedFile(path)), `${actor.name}: ${path}`).toBe(true);
      }
    }
  });

  it('gives each cache a core Foundry icon', () => {
    for (const actor of actors.filter(isCache)) {
      expect(actor.img, actor.name).toMatch(/^icons\/.+\.webp$/);
      expect(actor.prototypeToken.texture.src, actor.name).toBe(actor.img);
    }
  });

  it('gives players Limited on every loot actor, each holding something to take', () => {
    for (const actor of actors.filter((a) => a.type === 'loot')) {
      expect(actor.ownership.default, actor.name).toBe(1);
      expect(actor.items.length + (recipeOf(actor)?.treasure.length ?? 0), actor.name).toBeGreaterThan(0);
    }
  });

  it('ships nothing from PF2e: a stub holds our text and its stat block level, size and rarity', () => {
    for (const actor of actors.filter((a) => recipeOf(a)?.source)) {
      expect(Object.keys(actor.system).sort(), actor.name).toEqual(['_migration', 'details', 'traits']);
      expect(Object.keys(actor.system.details).sort(), actor.name).toEqual(['level', 'privateNotes', 'publicNotes']);
      expect(Object.keys(actor.system.traits).sort(), actor.name).toEqual(['rarity', 'size']);
      expect(actor.effects, actor.name).toEqual([]);
    }
    for (const actor of actors) {
      for (const item of actor.items) {
        const where = `${actor.name}: ${item.name}`;
        expect(item._stats?.compendiumSource ?? null, where).toBeNull();
        expect(item.system.spell, where).toBeUndefined();
        expect(['', 'Points of Interest'], where).toContain(item.system.publication?.title ?? '');
      }
    }
  });

  it('names only PF2e compendium documents in its recipes', () => {
    for (const actor of actors) {
      const recipe = recipeOf(actor);
      if (!recipe) continue;
      for (const uuid of requiredUuids(recipe)) expect(uuid, actor.name).toMatch(PF2E_UUID);
      for (const op of recipe.ops) if (op.op === 'copyItem') expect(op.uuid, actor.name).toMatch(PF2E_UUID);
    }
  });

  it('hashes each recipe and verified it against an installed PF2e system', () => {
    for (const actor of actors) {
      const recipe = recipeOf(actor);
      if (!recipe) continue;
      const { hash, verified, ...body } = recipe;
      expect(hash, actor.name).toBe(createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16));
      expect(verified, actor.name).toMatch(/^\d+\.\d+\.\d+$/);
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

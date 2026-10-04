import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MODULE_ID = 'points-of-interest';
const SERVED = `modules/${MODULE_ID}/`;

interface Doc { _id: string; _key: string; name: string }
interface Rule { key: string; property?: string; value?: unknown }
interface Item extends Doc {
  type: string;
  flags?: { pf2e?: { linkedWeapon?: string } };
  system: {
    size?: string;
    usage?: { value: string };
    traits?: { value: string[] };
    equipped?: { carryType: string; inSlot?: boolean; invested?: boolean | null };
    runes?: { property?: string[] };
    rules?: Rule[];
    spell?: { system: { traits: { traditions?: string[] } } };
    tradition?: { value: string };
  };
}
interface ActorSource extends Doc {
  type: string;
  img: string;
  folder: string | null;
  ownership: { default: number };
  items: Item[];
  prototypeToken: { name: string; texture: { src: string } };
  flags: Record<string, { encounter?: number; kind?: string; usesGear?: boolean; stowed?: boolean }>;
  system: { details: { privateNotes?: string; description?: string }; traits?: { size: { value: string }; value: string[] } };
}

const readDir = <T>(dir: string): T[] =>
  readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T);

const docs = readDir<Doc>(join(ROOT, 'packs', '_source', 'actors'));
const actors = docs.filter((d) => d._key.startsWith('!actors!')) as ActorSource[];
const folders = docs.filter((d) => d._key.startsWith('!folders!'));
const isCache = (actor: ActorSource): boolean => actor.flags[MODULE_ID]?.kind === 'cache';

const journals = readDir<{ _id: string; pages: Doc[] }>(join(ROOT, 'packs', '_source', 'journals'));
const pageUuids = new Set(
  journals.flatMap((j) => j.pages.map((p) => `Compendium.${MODULE_ID}.journals.JournalEntry.${j._id}.JournalEntryPage.${p._id}`)),
);

const servedFile = (path: string): string => join(ROOT, path.slice(SERVED.length));

const itemTraits = (item: Item): string[] => item.system.traits?.value ?? [];
const isWorn = (item: Item): boolean => item.type === 'equipment' && !!item.system.usage?.value.startsWith('worn');

// Weapons (bombs among them), armour, shields and worn items must fit the wielder's size; a potion or
// elixir needs a living drinker; a scroll or wand needs a caster of one of its spell's traditions.
function canUse(wielder: ActorSource, item: Item): boolean {
  if (['weapon', 'armor', 'shield'].includes(item.type) || isWorn(item)) return item.system.size === wielder.system.traits?.size.value;
  if (item.type !== 'consumable') return false;
  const traits = itemTraits(item);
  if (traits.includes('scroll') || traits.includes('wand')) {
    const traditions = item.system.spell?.system.traits.traditions ?? [];
    return wielder.items.some((i) => i.type === 'spellcastingEntry' && traditions.includes(i.system.tradition?.value ?? ''));
  }
  const living = !wielder.system.traits?.value.some((t) => t === 'undead' || t === 'construct');
  return living || !(traits.includes('potion') || traits.includes('elixir'));
}

// NPC strikes are melee items; a weapon is in use when one links to it. A consumable is in use once carried.
function inUse(holder: ActorSource, item: Item): boolean {
  const equipped = item.system.equipped;
  if (item.type === 'weapon') return holder.items.some((i) => i.type === 'melee' && i.flags?.pf2e?.linkedWeapon === item._id);
  if (item.type === 'armor') return equipped?.carryType === 'worn' && !!equipped.inSlot;
  if (item.type === 'shield') return equipped?.carryType === 'held';
  if (item.type === 'consumable') return true;
  const slotted = item.system.usage?.value !== 'worn';
  const investable = !!item.system.traits?.value.includes('invested');
  return equipped?.carryType === 'worn' && (!slotted || !!equipped.inSlot) && (!investable || !!equipped.invested);
}

describe('actors pack sources', () => {
  it('has one actor per portrait, a second Ilthuliak token, the two hazards and the treasure caches', () => {
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
      expect(actor.items.length, actor.name).toBeGreaterThan(0);
    }
  });

  it('leaves nothing an enemy at its site could use lying in the open: an enemy carries it and uses it', () => {
    const unused: string[] = [];
    for (const encounter of new Set(actors.map((a) => a.flags[MODULE_ID]?.encounter))) {
      const site = actors.filter((a) => a.flags[MODULE_ID]?.encounter === encounter);
      const wielders = site.filter((a) => a.flags[MODULE_ID]?.kind === 'creature' && a.flags[MODULE_ID]?.usesGear);
      for (const holder of site.filter((a) => !a.flags[MODULE_ID]?.stowed)) {
        for (const item of holder.items) {
          const fit = wielders.filter((w) => canUse(w, item));
          if (fit.length && !(fit.includes(holder) && inUse(holder, item))) unused.push(`${holder.name}: ${item.name}`);
        }
      }
    }
    expect(unused).toEqual([]);
  });

  it("gives every strike its linked weapon's property runes, as AdjustStrike rules", () => {
    const mismatched: string[] = [];
    for (const actor of actors) {
      for (const strike of actor.items.filter((i) => i.type === 'melee')) {
        const weapon = actor.items.find((i) => i._id === strike.flags?.pf2e?.linkedWeapon);
        const applied = (strike.system.rules ?? []).filter((r) => r.key === 'AdjustStrike' && r.property === 'property-runes').map((r) => String(r.value));
        const runes = weapon?.system.runes?.property ?? [];
        if (weapon && [...applied].sort().join() !== [...runes].sort().join()) {
          mismatched.push(`${actor.name}: ${strike.name} applies [${applied}], ${weapon.name} has [${runes}]`);
        }
      }
    }
    expect(mismatched).toEqual([]);
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

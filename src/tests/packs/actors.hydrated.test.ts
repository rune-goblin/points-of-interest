// Needs an installed PF2e system (--system, $PF2E_SYSTEM or the usual install path) and skips
// without one, so CI runs only the stub checks. Run it after every PF2e update.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hydrate, lookup, recipeOf, type Json } from '../../actors/hydrate';
import { unrunedStrikes, unusedGear } from './actor-rules';

const ROOT = process.cwd();
const MODULE_ID = 'points-of-interest';

interface Pf2ePacks {
  findSystem(argv?: string[]): string | undefined;
  systemVersion(system: string): string;
  loadPacks(system: string, packs: string[]): Map<string, Json>;
}
// Loaded at runtime: tsconfig.json's rootDir is src/, so a static import of scripts/ fails `npm run check`.
const { findSystem, loadPacks, systemVersion } = (await import(/* @vite-ignore */ join(ROOT, 'scripts', 'pf2e-packs.ts'))) as Pf2ePacks;

const stubs = readdirSync(join(ROOT, 'packs', '_source', 'actors'))
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'packs', '_source', 'actors', f), 'utf8')) as Json);

const system = findSystem([]);
const packs = new Set(
  stubs.flatMap((s) => {
    const recipe = recipeOf(s);
    const uuids = recipe ? [recipe.source, ...recipe.treasure.flatMap((t) => (t.kind === 'gear' ? [t.uuid] : t.kind === 'scroll' ? [t.spell, t.base] : []))] : [];
    return uuids.filter((u): u is string => !!u).map((u) => u.split('.')[2]);
  }),
);
const docs = system ? loadPacks(system, [...packs]) : new Map<string, Json>();
const env = { systemVersion: system ? systemVersion(system) : '', resolve: (uuid: string) => lookup(docs, uuid) };
const results = system ? stubs.map((stub) => ({ stub, ...hydrate(stub, env) })) : [];
const actors = results.map((r) => r.actor);
const kind = (actor: Json): string => actor.flags[MODULE_ID]?.kind;

describe.skipIf(!system)('actors hydrated against the installed PF2e system', () => {
  it('hydrates every recipe without an error or a warning', () => {
    expect(results.flatMap((r) => [r.error, ...r.warnings].filter(Boolean))).toEqual([]);
  });

  it('keeps the level, size and rarity each stub carries', () => {
    for (const { stub, actor } of results.filter((r) => recipeOf(r.stub)?.source)) {
      expect(actor.system.details.level.value, stub.name).toBe(stub.system.details.level.value);
      expect(actor.system.traits.size.value, stub.name).toBe(stub.system.traits.size.value);
      expect(actor.system.traits.rarity, stub.name).toBe(stub.system.traits.rarity);
    }
  });

  it('leaves nothing an enemy at its site could use lying in the open: an enemy carries it and uses it', () => {
    expect(unusedGear(actors)).toEqual([]);
  });

  it("gives every strike its linked weapon's property runes, as AdjustStrike rules", () => {
    expect(unrunedStrikes(actors)).toEqual([]);
  });

  it('gives every NPC and voice Perception, Will, skills and named lore', () => {
    for (const actor of actors.filter((a) => ['npc', 'voice'].includes(kind(a)))) {
      const lores = (actor.items as Json[]).filter((i) => i.type === 'lore').map((i) => i.name as string);
      expect(actor.system.perception?.mod, actor.name).toBeGreaterThan(0);
      expect(actor.system.saves?.will.value, actor.name).toBeGreaterThan(0);
      expect(Object.keys(actor.system.skills ?? {}).length + lores.length, actor.name).toBeGreaterThan(0);
      expect(lores.filter((n) => /\bany\b|additional|narrow/i.test(n)), actor.name).toEqual([]);
    }
  });

  it('gives voices no strikes or gear of their own', () => {
    for (const actor of actors.filter((a) => kind(a) === 'voice')) {
      expect((actor.items as Json[]).filter((i) => i.type === 'melee' || i.type === 'weapon').map((i) => i.name), actor.name).toEqual([]);
    }
  });
});

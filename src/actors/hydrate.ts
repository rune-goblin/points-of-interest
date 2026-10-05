// The actors pack ships stubs: our names, art, notes and items, plus a recipe naming the PF2e documents
// to build each stat block from. This turns a stub into a full actor source. It stays pure so the module
// runs it in Foundry and the build and specs run it in Node against an unpacked PF2e system.
import { MODULE_ID } from '../constants.ts';

export type Json = Record<string, any>;

/** An item in the source stat block: its embedded id, and its generic name for when the id drifts. */
export interface ItemRef {
  id: string;
  name: string;
}

export interface Runes {
  potency?: number;
  striking?: number;
  resilient?: number;
  property?: string[];
}

export type Op =
  | { op: 'removeItems'; types?: string[]; items?: ItemRef[]; spellcasting?: boolean }
  | { op: 'renameItem'; item: ItemRef; name: string }
  | { op: 'set'; path: string; value: unknown }
  | { op: 'addTraits'; traits: string[] }
  | { op: 'strikeBonus'; value: number }
  | { op: 'strikeRunes'; item: ItemRef; runes: string[] }
  | { op: 'copyItem'; uuid: string };

export type Treasure =
  | { kind: 'stock'; item: ItemRef; name?: string; runes?: Runes; note?: string }
  | {
      kind: 'gear';
      uuid: string;
      id: string;
      name?: string;
      quantity?: number;
      runes?: Runes;
      material?: { type: string; grade: string };
      size?: string;
      note?: string;
    }
  | { kind: 'scroll'; spell: string; base: string; rank: number; id: string; spellId: string };

export interface Recipe {
  source?: string;
  adjustment?: 'elite' | 'weak';
  ops: Op[];
  treasure: Treasure[];
  /** Changes whenever the recipe does, so a world can tell its actors were built from an older one. */
  hash: string;
  /** The PF2e version the build hydrated this recipe against without a warning. */
  verified?: string;
}

export interface Hydrated {
  hash: string;
  pf2e: string;
}

export interface Env {
  systemVersion: string;
  /** A plain source for a compendium UUID, including an item embedded in a compendium actor. */
  resolve(uuid: string): Json | undefined;
}

export interface Result {
  actor: Json;
  warnings: string[];
  error?: string;
}

const PHYSICAL = new Set(['weapon', 'armor', 'shield', 'equipment', 'consumable', 'treasure', 'backpack', 'ammo', 'book']);
export const BODYLESS = ['melee', ...PHYSICAL];

export const recipeOf = (actor: Json): Recipe | undefined => actor.flags?.[MODULE_ID]?.recipe;
export const hydratedOf = (actor: Json): Hydrated | undefined => actor.flags?.[MODULE_ID]?.hydrated;

/** Every compendium document a recipe reads, as top-level UUIDs a pack can fetch by id. */
export function requiredUuids(recipe: Recipe): string[] {
  const uuids = [
    recipe.source,
    ...recipe.ops.map((op) => (op.op === 'copyItem' ? op.uuid : undefined)),
    ...recipe.treasure.flatMap((t) => (t.kind === 'gear' ? [t.uuid] : t.kind === 'scroll' ? [t.spell, t.base] : [])),
  ];
  return [...new Set(uuids.filter((u): u is string => !!u).map(topLevel))];
}

const topLevel = (uuid: string): string => uuid.split('.').slice(0, 5).join('.');

/** Looks a UUID up in sources keyed by top-level UUID, descending into a compendium actor's items. */
export function lookup(sources: Map<string, Json>, uuid: string): Json | undefined {
  const parent = sources.get(topLevel(uuid));
  const parts = uuid.split('.');
  if (parts.length === 5 || !parent) return parent;
  if (parts[5] !== 'Item') return undefined;
  return (parent.items as Json[] | undefined)?.find((i) => i._id === parts[6]);
}

const html = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const withNote = (description: string, note: string): string => `<p><em>${html(note)}</em></p>\n${description}`;

// Mirrors getHpAdjustment in the PF2e system's actor/creature/helpers.ts; NPCPF2e#applyAdjustment stores
// the adjustment and shifts current HP by it, which is the write this makes up front.
function hpAdjustment(level: number, adjustment: 'elite' | 'weak'): number {
  if (adjustment === 'elite') return level >= 20 ? 30 : level >= 5 ? 20 : level >= 2 ? 15 : 10;
  return level >= 21 ? -30 : level >= 6 ? -20 : level >= 3 ? -15 : level >= 1 ? -10 : 0;
}

// NPC strikes reset their property runes on every prepare; PF2e applies a rune to a strike only
// through an AdjustStrike rule on it, the way the bestiaries encode a runed weapon.
function addRuneRules(strike: Json, runes: string[]): void {
  const rules: Json[] = (strike.system.rules ??= []);
  for (const rune of runes) {
    if (rules.some((r) => r.key === 'AdjustStrike' && r.property === 'property-runes' && r.value === rune)) continue;
    rules.push({ definition: ['item:id:{item|_id}'], key: 'AdjustStrike', mode: 'add', property: 'property-runes', value: rune });
  }
}

// Gear handed to an enemy that can use it goes on, as the gear rule in the actor specs expects.
function wield(item: Json): string | undefined {
  const usage: string = item.system.usage?.value ?? '';
  const traits: string[] = item.system.traits?.value ?? [];
  if (item.type === 'armor') item.system.equipped = { carryType: 'worn', handsHeld: 0, inSlot: true };
  if (item.type === 'shield') item.system.equipped = { carryType: 'held', handsHeld: 1 };
  if (item.type === 'equipment' && usage.startsWith('worn')) {
    item.system.equipped = { carryType: 'worn', handsHeld: 0, inSlot: usage !== 'worn', invested: traits.includes('invested') };
  }
  return item.type === 'weapon' ? `${item.name} is gear; give it as stock so a strike links to it` : undefined;
}

function setPath(target: Json, path: string, value: unknown): boolean {
  const keys = path.split('.');
  const last = keys.pop()!;
  let node: any = target;
  for (const key of keys) {
    if (!node || typeof node !== 'object' || !(key in node)) return false;
    node = node[key];
  }
  if (!node || typeof node !== 'object') return false;
  node[last] = structuredClone(value);
  return true;
}

function clean(item: Json, id: string, compendiumSource: string): Json {
  const copy = structuredClone(item);
  delete copy._key;
  delete copy.folder;
  copy._id = id;
  copy._stats = { ...copy._stats, compendiumSource };
  return copy;
}

export function hydrate(stub: Json, env: Env): Result {
  const recipe = recipeOf(stub);
  const warnings: string[] = [];
  if (!recipe) return { actor: stub, warnings };
  const actor = structuredClone(stub);
  const warn = (message: string): void => void warnings.push(`${stub.name}: ${message}`);

  let items: Json[] = [];
  if (recipe.source) {
    const source = env.resolve(recipe.source);
    if (!source || source.type !== stub.type) return { actor: stub, warnings, error: `${stub.name}: no PF2e ${stub.type} at ${recipe.source}` };
    const ours = stub.system.details ?? {};
    actor.system = structuredClone(source.system);
    actor.effects = structuredClone(source.effects ?? []);
    items = structuredClone(source.items ?? []);
    const details = actor.system.details;
    details.publicNotes = [details.publicNotes, ours.publicNotes].filter(Boolean).join('\n');
    details.privateNotes = [ours.privateNotes, details.privateNotes].filter(Boolean).join('\n');
  }

  const find = (ref: ItemRef, type?: string): Json | undefined => {
    const fits = (i: Json): boolean => !type || i.type === type;
    const byId = items.find((i) => i._id === ref.id && fits(i));
    if (byId) return byId;
    const byName = items.find((i) => i.name === ref.name && fits(i));
    warn(byName ? `item ${ref.id} is gone; matched "${ref.name}" by name` : `no item ${ref.id} ("${ref.name}")`);
    return byName;
  };

  for (const op of recipe.ops) {
    switch (op.op) {
      case 'removeItems': {
        const types = new Set(op.types ?? []);
        const named = new Set((op.items ?? []).map((ref) => find(ref)).filter(Boolean));
        const entries = new Set(op.spellcasting ? items.filter((i) => i.type === 'spellcastingEntry').map((i) => i._id) : []);
        items = items.filter(
          (i) => !types.has(i.type) && !named.has(i) && !entries.has(i._id) && !(i.type === 'spell' && entries.has(i.system.location?.value)),
        );
        break;
      }
      case 'renameItem': {
        const item = find(op.item);
        if (item) item.name = op.name;
        break;
      }
      case 'set':
        if (!setPath(actor, op.path, op.value)) warn(`no ${op.path.split('.').slice(0, -1).join('.')} to set ${op.path} in`);
        break;
      case 'addTraits': {
        const traits = actor.system.traits;
        traits.value = [...new Set([...(traits.value ?? []), ...op.traits])].sort();
        break;
      }
      case 'strikeBonus':
        for (const strike of items.filter((i) => i.type === 'melee')) strike.system.bonus.value = op.value;
        break;
      case 'strikeRunes': {
        const strike = find(op.item, 'melee');
        if (strike) addRuneRules(strike, op.runes);
        break;
      }
      case 'copyItem': {
        const item = env.resolve(op.uuid);
        if (item) items.push(clean(item, item._id, op.uuid));
        else warn(`no PF2e item at ${op.uuid}`);
        break;
      }
    }
  }

  const loot: Json[] = [];
  for (const entry of recipe.treasure) {
    if (entry.kind === 'stock') {
      const item = find(entry.item);
      if (!item) continue;
      if (entry.name) item.name = entry.name;
      if (entry.runes) item.system.runes = { ...item.system.runes, ...entry.runes };
      if (entry.note) item.system.description.value = withNote(item.system.description.value, entry.note);
    } else if (entry.kind === 'gear') {
      const source = env.resolve(entry.uuid);
      if (!source) {
        warn(`no PF2e item at ${entry.uuid}`);
        continue;
      }
      const item = clean(source, entry.id, entry.uuid);
      if (entry.name) item.name = entry.name;
      if (entry.quantity) item.system.quantity = entry.quantity;
      if (entry.runes) item.system.runes = entry.runes;
      if (entry.material) item.system.material = entry.material;
      if (entry.size) item.system.size = entry.size;
      if (entry.note) item.system.description.value = withNote(item.system.description.value, entry.note);
      loot.push(item);
    } else {
      const spell = env.resolve(entry.spell);
      const base = env.resolve(entry.base);
      if (!spell || !base) {
        warn(`no PF2e spell ${entry.spell} or scroll ${entry.base}`);
        continue;
      }
      // Mirrors createConsumableFromSpell in the PF2e system: the rank's generic scroll, renamed, with the spell embedded.
      const item = clean(base, entry.id, entry.base);
      item.name = `Scroll of ${spell.name} (Rank ${entry.rank})`;
      item.system.traits.value = [...new Set([...item.system.traits.value, ...spell.system.traits.value])].sort();
      item.system.traits.rarity = spell.system.traits.rarity;
      item.system.description.value = `<p>@UUID[${entry.spell}]{${spell.name}}</p>\n<hr />\n${item.system.description.value}`;
      const embedded = clean(spell, entry.spellId, entry.spell);
      embedded.system.location = { value: null, heightenedLevel: entry.rank };
      item.system.spell = embedded;
      loot.push(item);
    }
  }
  if (stub.flags?.[MODULE_ID]?.usesGear) {
    for (const item of loot) {
      const problem = wield(item);
      if (problem) warn(problem);
    }
  }

  actor.items = [...items, ...structuredClone(stub.items ?? []), ...loot];
  for (const strike of actor.items.filter((i: Json) => i.type === 'melee')) {
    const weapon = actor.items.find((i: Json) => i._id === strike.flags?.pf2e?.linkedWeapon);
    if (weapon) addRuneRules(strike, weapon.system.runes?.property ?? []);
  }
  const ids = actor.items.map((i: Json) => i._id);
  if (new Set(ids).size !== ids.length) warn('two items share an id');

  if (recipe.adjustment) {
    const { attributes, details } = actor.system;
    attributes.adjustment = recipe.adjustment;
    attributes.hp.value += hpAdjustment(details.level.value, recipe.adjustment);
  }

  actor.flags[MODULE_ID].hydrated = { hash: recipe.hash, pf2e: env.systemVersion } satisfies Hydrated;
  return { actor, warnings };
}

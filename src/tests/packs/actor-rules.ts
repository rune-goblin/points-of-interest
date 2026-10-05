// The rules a hydrated actor must keep, shared by the specs that check them.
import type { Json } from '../../actors/hydrate';
import { MODULE_ID } from '../../constants';

const itemTraits = (item: Json): string[] => item.system.traits?.value ?? [];
const isWorn = (item: Json): boolean => item.type === 'equipment' && !!item.system.usage?.value?.startsWith('worn');
const flags = (actor: Json): Json => actor.flags?.[MODULE_ID] ?? {};

// Weapons (bombs among them), armour, shields and worn items must fit the wielder's size; a potion or
// elixir needs a living drinker; a scroll or wand needs a caster of one of its spell's traditions.
function canUse(wielder: Json, item: Json): boolean {
  if (['weapon', 'armor', 'shield'].includes(item.type) || isWorn(item)) return item.system.size === wielder.system.traits?.size.value;
  if (item.type !== 'consumable') return false;
  const traits = itemTraits(item);
  if (traits.includes('scroll') || traits.includes('wand')) {
    const traditions: string[] = item.system.spell?.system.traits.traditions ?? [];
    return (wielder.items as Json[]).some((i) => i.type === 'spellcastingEntry' && traditions.includes(i.system.tradition?.value ?? ''));
  }
  const living = !(wielder.system.traits?.value ?? []).some((t: string) => t === 'undead' || t === 'construct');
  return living || !(traits.includes('potion') || traits.includes('elixir'));
}

// NPC strikes are melee items; a weapon is in use when one links to it. A consumable is in use once carried.
function inUse(holder: Json, item: Json): boolean {
  const equipped = item.system.equipped;
  if (item.type === 'weapon') return (holder.items as Json[]).some((i) => i.type === 'melee' && i.flags?.pf2e?.linkedWeapon === item._id);
  if (item.type === 'armor') return equipped?.carryType === 'worn' && !!equipped.inSlot;
  if (item.type === 'shield') return equipped?.carryType === 'held';
  if (item.type === 'consumable') return true;
  const slotted = item.system.usage?.value !== 'worn';
  const investable = itemTraits(item).includes('invested');
  return equipped?.carryType === 'worn' && (!slotted || !!equipped.inSlot) && (!investable || !!equipped.invested);
}

/** Items at a site that an enemy there could use, but which no such enemy carries and uses. */
export function unusedGear(actors: Json[]): string[] {
  const unused: string[] = [];
  for (const encounter of new Set(actors.map((a) => flags(a).encounter))) {
    const site = actors.filter((a) => flags(a).encounter === encounter);
    const wielders = site.filter((a) => flags(a).kind === 'creature' && flags(a).usesGear);
    for (const holder of site.filter((a) => !flags(a).stowed)) {
      for (const item of holder.items as Json[]) {
        const fit = wielders.filter((w) => canUse(w, item));
        if (fit.length && !(fit.includes(holder) && inUse(holder, item))) unused.push(`${holder.name}: ${item.name}`);
      }
    }
  }
  return unused;
}

/** Strikes whose AdjustStrike property runes differ from their linked weapon's. */
export function unrunedStrikes(actors: Json[]): string[] {
  const mismatched: string[] = [];
  for (const actor of actors) {
    const items = actor.items as Json[];
    for (const strike of items.filter((i) => i.type === 'melee')) {
      const weapon = items.find((i) => i._id === strike.flags?.pf2e?.linkedWeapon);
      const applied = ((strike.system.rules ?? []) as Json[])
        .filter((r) => r.key === 'AdjustStrike' && r.property === 'property-runes')
        .map((r) => String(r.value));
      const runes: string[] = weapon?.system.runes?.property ?? [];
      if (weapon && [...applied].sort().join() !== [...runes].sort().join()) {
        mismatched.push(`${actor.name}: ${strike.name} applies [${applied}], ${weapon.name} has [${runes}]`);
      }
    }
  }
  return mismatched;
}

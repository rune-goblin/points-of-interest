// Generate the actors pack sources: one actor per character in docs/art/by-type/characters.md,
// the two custom hazards, and a loot actor per treasure cache. An actor built on a PF2e stat block
// ships as a stub: our name, art, notes, items and the stat block's level, size and rarity, plus a
// recipe naming the PF2e documents and the changes the module applies when it hydrates the actor in
// a world (src/actors/hydrate.ts). Nothing copied from the system ships. The build hydrates every
// stub against the installed system and fails on any warning, then stamps the recipe verified.
// Not part of `npm run build`, because it needs a PF2e install; the output is committed.
//   node scripts/build-actors.ts [--system <path to Data/systems/pf2e>]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BODYLESS, hydrate, lookup, type ItemRef, type Op, type Recipe, type Runes, type Treasure } from '../src/actors/hydrate.ts';
import { findSystem, loadPacks, systemVersion } from './pf2e-packs.ts';
import { MODULE_ID, ids, pad, rootFolder, slugify, stableId } from './stable-id.ts';

const ROOT = process.cwd();
const OUT = join(ROOT, 'packs', '_source', 'actors');

type Json = Record<string, any>;

const encountersMd = readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8');
const titles = new Map([...encountersMd.matchAll(/^### (\d+)\. (.+)$/gm)].map((m) => [Number(m[1]), m[2].trim()]));

function encounterLink(n: number): string {
  const title = titles.get(n)!;
  const slug = slugify(`${n}. ${title}`);
  return `@UUID[Compendium.${MODULE_ID}.journals.JournalEntry.${ids.journal()}.JournalEntryPage.${ids.encounterPage(slug)}]{${pad(n)}. ${title}}`;
}

// The art briefs: "## NN. Title" > "### Character" > "- **Portrait:** text".
const charactersMd = readFileSync(join(ROOT, 'docs', 'art', 'by-type', 'characters.md'), 'utf8');
const portraits = new Map<string, string>();
{
  let encounter = 0;
  let heading = '';
  for (const line of charactersMd.split('\n')) {
    const zone = /^## (\d+)\. /.exec(line);
    if (zone) encounter = Number(zone[1]);
    const h = /^### (.+)$/.exec(line);
    if (h) heading = h[1].trim();
    const p = /^- \*\*Portrait:\*\* (.+)$/.exec(line);
    if (p) portraits.set(`${encounter}/${heading}`, p[1].trim());
  }
}

type Kind = 'creature' | 'npc' | 'remains' | 'voice' | 'hazard' | 'cache';
interface Spec {
  slug: string;
  name: string;
  /** characters.md heading under the encounter; omitted for the haunt, which has no brief. */
  brief?: string;
  role: string;
  kind: Kind;
  /** UUID of the PF2e stat block the actor hydrates from. */
  source?: string;
  adjustment?: 'elite' | 'weak';
  linked?: boolean;
  /** Shown on the canvas when it must differ from the actor name, e.g. so a double passes for the original. */
  tokenName?: string;
  /** Paths under assets/; default `portraits/<slug>.webp` and `tokens/<slug>.webp`. */
  portrait?: string;
  token?: string;
  /** A core Foundry icon for both portrait and token, for caches that have no art of their own. */
  icon?: string;
  /** Its body can wield weapons and shields and wear armour and worn items. Gear of its size at its site must be in its hands. */
  usesGear?: boolean;
  /** A cache shut away in a chest, strongbox, sealed chamber or hidden packet rather than lying in the open, so its gear needn't be in an enemy's hands. */
  stowed?: boolean;
  /** Lore skills of our own, as items the stub carries. */
  lores?: Record<string, number>;
  custom?: (actorId: string) => Json;
  patch?: (source: Json) => Op[];
}

const actorUuid = (pack: string) => (id: string): string => `Compendium.pf2e.${pack}.Actor.${id}`;
const KM = actorUuid('kingmaker-bestiary');
const MC = actorUuid('pathfinder-monster-core');
const MC2 = actorUuid('pathfinder-monster-core-2');
const B1 = actorUuid('pathfinder-bestiary');
const B2 = actorUuid('pathfinder-bestiary-2');
const NPC = actorUuid('pathfinder-npc-core');
const EQUIPMENT = (id: string): string => `Compendium.pf2e.equipment-srd.Item.${id}`;
const SPELL = (id: string): string => `Compendium.pf2e.spells-srd.Item.${id}`;
const ACTOR_PACKS = ['kingmaker-bestiary', 'pathfinder-bestiary', 'pathfinder-bestiary-2', 'pathfinder-monster-core', 'pathfinder-monster-core-2', 'pathfinder-npc-core'];

const ANKOU_ASSASSIN = KM('m8kwG6NskYDlBSCy');
const OZTHOOM = MC2('EG8jLZfIfTwA0b5g');
const OZTHOOM_SHADOW_DOUBLE = MC2('wNa8UPQqSepdxscG');
const CAUTHOOJ = MC('1a5faH5CCtFfbQHO');
const ATHACH = B2('CwrVQsRAeqlr1Vh0');
const HILL_GIANT_BUTCHER = KM('bF0FHdZMWl1OuRae');
const WYVERN_QUEEN = KM('SjU0oB6pOk0XY8VN');
const RADIANT_WARDEN = KM('ASevlX00GdHGNWrS');
const WILD_HUNT_HOUND = KM('OnHIutiVLt1czwWL');
const WHIMWYRM = KM('SfFMqKTUQ1Dwu5lT');
const BLACK_DRAGON = KM('n82GZhM6joceE91v');

// NPC Core picks for the noncombatants; the role decides the stat block, the art decides the name.
const MAESTRO = NPC('1wk2fBlDuHLRYfJW');
const TROUBADOUR = NPC('55t4OPNXDx6fAeZd');
const STREET_MUSICIAN = NPC('srsib4P14wAYv4pS');
const FARMER = NPC('bZRZahVaMyzTbJ4u');
const MERCHANT = NPC('qCKNT6U8O0su578A');
const PROPHET = NPC('mbuHsZrLEieLEES0');
const CAPTAIN_OF_THE_GUARD = NPC('vEdg4AXGWfet1Cgy');
const COMMONER = NPC('APn9B54hhRtr0oCQ');
const TAX_COLLECTOR = NPC('Xxnho8AZopSuhgHP');
const GUIDE = NPC('ndCqM6yNTg2QPZwK');
const BANDIT = NPC('FBq4bqtKUBpJUCMU');
const MECHANIC = NPC('Koz2GhqliCU5sIJl');
const GADGETEER = NPC('jx5KZC2tbgJIJnOq');
const MAYOR = NPC('HKQofrjurRdgEq3p');
const DROVER = NPC('aq5spzk2UZrI0ZwK');
// The dead antiquarians keep the stat blocks they had in life, for a spell like Talking Corpse or a resurrection.
const AVUNCULAR_PROFESSOR = NPC('hZ2ch39MaaKFKgtJ');
const OBSESSIVE_RESEARCHER = NPC('DPSvIsPlVrlx7Q8V');
const TOMB_RAIDER = NPC('Yl6pxCXAoFECt89L');
const SAGE = NPC('3R2J90R84AUgFJH2');
const ANTIQUARIAN = 'Stat block as in life, without the gear left in the camp; the Skulltaker actor holds the statistics the wall fights with.';
const JOTUND_TROLL = MC2('4Ay3tf49upoyaJrg');

/** A source stat block's item, by the name it has in the installed system. */
function ref(source: Json, name: string, type?: string): ItemRef {
  const item = (source.items as Json[]).find((i) => i.name === name && (!type || i.type === type));
  if (!item) throw new Error(`${source.name}: no ${type ?? 'item'} "${name}"`);
  return { id: item._id, name };
}

// The Ankou Assassin's Shadow Doubles: "the same statistics as an ankou, but they have the
// summoned trait, have 110 Hit Points, can't use Shadow Doubles or innate spells, and have an
// attack bonus of +27 for their Strikes", plus the light-save cap MC2's Ozthoom Shadow Double encodes.
let lightSaveCap = '';
function shadowDouble(source: Json): Op[] {
  return [
    { op: 'set', path: 'system.attributes.hp.max', value: 110 },
    { op: 'set', path: 'system.attributes.hp.value', value: 110 },
    { op: 'addTraits', traits: ['summoned'] },
    { op: 'removeItems', spellcasting: true, items: [ref(source, 'Shadow Doubles')] },
    { op: 'strikeBonus', value: 27 },
    { op: 'copyItem', uuid: lightSaveCap },
  ];
}

function overrideStats(perception: number, will: number) {
  return (): Op[] => [
    { op: 'set', path: 'system.perception.mod', value: perception },
    { op: 'set', path: 'system.saves.will.value', value: will },
  ];
}

function renameItem(from: string, to: string) {
  return (source: Json): Op[] => [{ op: 'renameItem', item: ref(source, from), name: to }];
}

/** Runes for a strike with no weapon item behind it, such as a creature's own magical blade. */
function runeStrike(name: string, runes: string[]) {
  return (source: Json): Op[] => [{ op: 'strikeRunes', item: ref(source, name, 'melee'), runes }];
}

function loreItem(actorId: string, name: string, mod: number): Json {
  const _id = stableId(`lore:${actorId}:${slugify(name)}`);
  return {
    _id,
    _key: `!actors.items!${actorId}.${_id}`,
    img: 'systems/pf2e/icons/default-icons/lore.svg',
    name,
    sort: 0,
    system: {
      description: { value: '' },
      mod: { value: mod },
      proficient: { value: 0 },
      publication: publication('Points of Interest'),
      rules: [],
      slug: null,
      traits: {},
      _migration: MIGRATION,
    },
    type: 'lore',
    effects: [],
  };
}

// A head speaks with the troll's defences; the troll's strikes and abilities belong to its body.
function trollHead(skills: Record<string, number>) {
  return (): Op[] => [
    { op: 'removeItems', types: ['action'] },
    ...Object.entries(skills).map(([skill, base]): Op => ({ op: 'set', path: `system.skills.${skill}`, value: { base } })),
    { op: 'set', path: 'system.details.blurb', value: 'Head of the Jotund Troll' },
  ];
}


const ENCOUNTERS: Record<number, Spec[]> = {
  1: [
    { slug: '01-ankou', name: 'The Ankou', brief: "The Ankou (the Fey Queen's assassin)", kind: 'creature', usesGear: true, source: ANKOU_ASSASSIN, linked: true,
      role: "The Fey Queen's ankou. Drops from the rafters once the PCs find the shadow jar or three clues, opens with Shadow Doubles, and withdraws below 150 HP. If it escapes, it returns as the Speaker or the spared ankou in encounter 14." },
    { slug: '01-ankou-shadow-double-first', name: "The Ankou's Shadow Double (First)", brief: "The Ankou's Shadow Double (first)", kind: 'creature', usesGear: true, source: ANKOU_ASSASSIN, patch: shadowDouble, tokenName: 'The Ankou',
      role: "A double from the ankou's Shadow Doubles (110 HP, Strikes +27, no innate spells). It vanishes when the ankou leaves or dies." },
    { slug: '01-ankou-shadow-double-second', name: "The Ankou's Shadow Double (Second)", brief: "The Ankou's Shadow Double (second)", kind: 'creature', usesGear: true, source: ANKOU_ASSASSIN, patch: shadowDouble, tokenName: 'The Ankou',
      role: "The second double from Shadow Doubles (110 HP, Strikes +27, no innate spells)." },
    { slug: '01-felgo', name: 'Felgo', brief: 'Felgo (dead royal scout)', kind: 'remains', linked: true,
      role: 'The dead royal scout on the threshold, shadowless, two days dead with no wounds. DC 35 Medicine shows the heart simply stopped.' },
  ],
  2: [
    { slug: '02-maestra-ilsabet-rova', name: 'Maestra Ilsabet Rova', brief: 'Maestra Ilsabet Rova (composer, leader)', kind: 'npc', source: MAESTRO, linked: true,
      patch: overrideStats(18, 16),
      role: 'Leader of the Academy composers and the Influence target (6 Influence within 6 rounds). NPC Core Maestro, with Perception +18 and Will +16 from the encounter.' },
    { slug: '02-pell-composer', name: 'Pell', brief: 'Pell (youngest composer)', kind: 'npc', source: STREET_MUSICIAN, linked: true,
      role: 'The youngest composer, starving. He dies when the song stops unless a PC succeeds at a DC 36 Medicine check within 10 minutes. NPC Core Street Musician.' },
    { slug: '02-daro-vesk', name: 'Daro Vesk', brief: 'Daro Vesk (composer, percussionist)', kind: 'npc', source: TROUBADOUR, linked: true,
      role: 'Composer and percussionist; noncombatant. NPC Core Troubadour.' },
    { slug: '02-olenna-fair', name: 'Olenna Fair', brief: 'Olenna Fair (composer, copyist)', kind: 'npc', source: TROUBADOUR, linked: true,
      role: 'Composer and copyist; noncombatant. NPC Core Troubadour.' },
    { slug: '02-cauthooj-first', name: 'Cauthooj (Lead Singer)', brief: 'Cauthooj (first, the lead singer)', kind: 'creature', source: CAUTHOOJ,
      role: 'Lead singer of the three cauthoojes. Its Warbling Song is the hazard; Hop-Dodge redirects Strikes into confused composers.' },
    { slug: '02-cauthooj-second', name: 'Cauthooj (Second)', brief: 'Cauthooj (second)', kind: 'creature', source: CAUTHOOJ,
      role: 'One of the three cauthoojes circling the composers at about 60 feet.' },
    { slug: '02-cauthooj-third', name: 'Cauthooj (Third)', brief: 'Cauthooj (third)', kind: 'creature', source: CAUTHOOJ,
      role: 'The youngest of the three cauthoojes.' },
  ],
  3: [
    { slug: '03-jotund-troll', name: 'The Jotund Troll', brief: 'The Jotund Troll', kind: 'creature', usesGear: true, source: JOTUND_TROLL, linked: true,
      role: 'The nine-headed troll. It negotiates by head-vote and fights only if insulted twice, the vote fails, or the PCs attack; it flees into the moor at 120 HP.' },
    { slug: '03-envoy-troll-head', name: 'The Envoy (Troll Head)', brief: 'The Envoy (troll head)', kind: 'voice', source: JOTUND_TROLL, linked: true,
      patch: trollHead({ deception: 28, diplomacy: 28, society: 25 }), lores: { 'Royal Court Lore': 25 },
      role: "The head that mimics Ser Halward Toll and speaks for the Envoy bloc. It shares the Jotund Troll's defences, which take any damage; its courtly skills serve its lies and Sense Motive against it." },
    { slug: '03-old-heads', name: 'The Old Heads (Troll Heads)', brief: 'The Old Heads (troll heads)', kind: 'voice', source: JOTUND_TROLL, linked: true,
      patch: trollHead({ religion: 25 }), lores: { 'Barrow Lore': 28 },
      role: "The two Old Heads, the bloc that guards their mother's bones. They share the Jotund Troll's defences, which take any damage; Religion and Barrow Lore are what they know." },
    { slug: '03-ser-halward-toll', name: 'Ser Halward Toll', brief: 'Ser Halward Toll (dead envoy)', kind: 'remains', linked: true,
      role: "The King's envoy, eaten mid-negotiation. His head sits on a stake beside the barrow; his satchel holds the King's letter of offer, 400 gp and a greater bottled lightning." },
  ],
  4: [
    { slug: '04-matriarch-gorm', name: 'Matriarch Gorm', brief: 'Matriarch Gorm (athach, family head)', kind: 'creature', usesGear: true, source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Head of the athach family. Holds the manor rubble and uses Throw Rock from cover.' },
    { slug: '04-rorrik', name: 'Rorrik', brief: "Rorrik (athach, Gorm's mate)", kind: 'creature', usesGear: true, source: ATHACH, adjustment: 'elite', linked: true,
      role: "Gorm's mate. Holds the manor rubble beside her and hurls masonry." },
    { slug: '04-thud', name: 'Thud', brief: 'Thud (adolescent athach)', kind: 'creature', usesGear: true, source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Adolescent athach working the maze in a pair, flanking for Athach Venom.' },
    { slug: '04-snip', name: 'Snip', brief: 'Snip (adolescent athach)', kind: 'creature', usesGear: true, source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Adolescent athach working the maze in a pair.' },
    { slug: '04-mulch', name: 'Mulch', brief: 'Mulch (adolescent athach)', kind: 'creature', usesGear: true, source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Adolescent athach working the maze in a pair; starts by the compost pit.' },
    { slug: '04-bramble', name: 'Bramble', brief: 'Bramble (adolescent athach)', kind: 'creature', usesGear: true, source: ATHACH, adjustment: 'elite', linked: true,
      role: 'The smallest, cruellest adolescent athach; first to grab a victim as a hostage.' },
    { slug: '04-captain-mira-vell', name: 'Captain Mira Vell', brief: 'Captain Mira Vell (living statue, royal officer)', kind: 'npc', source: CAPTAIN_OF_THE_GUARD, linked: true,
      role: 'Royal officer and the most valuable victim: enfeebled 3 and unable to act until a DC 32 Medicine check or a cure. She can serve the PCs as an army commander or informant. NPC Core Captain of the Guard.' },
    { slug: '04-haddo', name: 'Haddo', brief: 'Haddo (living statue, farmer)', kind: 'npc', source: FARMER, linked: true,
      role: 'Victim on a plinth: enfeebled 3 and unable to act. NPC Core Farmer.' },
    { slug: '04-ysolde', name: 'Ysolde', brief: 'Ysolde (living statue, pedlar)', kind: 'npc', source: MERCHANT, linked: true,
      role: 'Victim on a plinth: enfeebled 3 and unable to act. NPC Core Merchant.' },
    { slug: '04-brother-amat', name: 'Brother Amat', brief: 'Brother Amat (living statue, wandering priest)', kind: 'npc', source: PROPHET, linked: true,
      role: 'Wandering priest of the hunter god on a plinth: enfeebled 3 and unable to act. NPC Core Prophet.' },
    { slug: '04-tobin-herder-boy', name: 'Tobin', brief: 'Tobin (living statue, boy)', kind: 'npc', source: COMMONER, linked: true,
      patch: renameItem('Lore (any one related to their trade)', 'Herding Lore'),
      role: 'A herder boy of about ten on a plinth: enfeebled 3 and unable to act. NPC Core Commoner.' },
  ],
  5: [
    { slug: '05-skulltaker', name: 'The Skulltaker', brief: 'The Skulltaker', kind: 'creature', source: MC('zkl6planCbeCuAdS'), linked: true,
      role: "Speaks through the antiquarians' skulls and trades Skeletal Lore answers for a new skull. In the fight it opens with Splintered Ground and keeps Shard Storm active." },
    { slug: '05-magister-corwen-ash', name: 'Magister Corwen Ash', brief: 'Magister Corwen Ash (dead antiquarian, voice in the wall)', kind: 'voice', source: AVUNCULAR_PROFESSOR, linked: true,
      patch: renameItem('One Additional Lore', 'Hill-Clan Lore'),
      role: `Dead antiquarian whose voice the skulltaker uses. ${ANTIQUARIAN} NPC Core Avuncular Professor.` },
    { slug: '05-dalia-sorn', name: 'Dalia Sorn', brief: 'Dalia Sorn (dead antiquarian)', kind: 'voice', source: OBSESSIVE_RESEARCHER, linked: true,
      patch: renameItem('Narrow Lore', 'Hill-Clan Art Lore'),
      role: `Dead antiquarian and field sketcher. ${ANTIQUARIAN} NPC Core Obsessive Researcher.` },
    { slug: '05-hemmet-brask', name: 'Hemmet Brask', brief: 'Hemmet Brask (dead antiquarian)', kind: 'voice', source: TOMB_RAIDER, linked: true,
      role: `Dead antiquarian and surveyor. ${ANTIQUARIAN} NPC Core Tomb Raider.` },
    { slug: '05-lio-venn', name: 'Lio Venn', brief: 'Lio Venn (dead antiquarian)', kind: 'voice', source: SAGE, linked: true,
      role: `Dead antiquarian and linguist. ${ANTIQUARIAN} NPC Core Sage.` },
    { slug: '05-skeletal-champion', name: 'Skeletal Champion', brief: 'Skeletal Champion (risen victim, optional)', kind: 'creature', usesGear: true, source: MC('FH58AcRBZIfrHKvv'),
      role: "A creature that dies within 60 feet of the skulltaker rises as this skeletal champion in 1d4 rounds unless it succeeds at a DC 40 Will save (Bonetaker). Bonetaker names the Monster Core skeletal champion, a level 2 creature; it adds bodies to the fight, not threat. At party level 18 the four antiquarians rise on round 2." },
  ],
  6: [
    { slug: '06-grosh', name: 'Grosh', brief: 'Grosh (butcher leader)', kind: 'creature', usesGear: true, source: HILL_GIANT_BUTCHER, linked: true,
      role: 'Leader of the four butchers. Opens with Menace Prey on the two richest-looking PCs.' },
    { slug: '06-murla', name: 'Murla', brief: 'Murla (rock-thrower)', kind: 'creature', usesGear: true, source: HILL_GIANT_BUTCHER, linked: true,
      role: 'Climbs the shelf path and uses Throw Rock from the rock pile.' },
    { slug: '06-tuk', name: 'Tuk', brief: 'Tuk (twin hatchets)', kind: 'creature', usesGear: true, source: HILL_GIANT_BUTCHER, linked: true,
      role: 'Closes and uses Twin Butchery on whoever leads.' },
    { slug: '06-hobb', name: 'Hobb', brief: 'Hobb (the coward)', kind: 'creature', usesGear: true, source: HILL_GIANT_BUTCHER, linked: true,
      role: 'The first to flee up the shelf path toward the Giant Lord once two butchers fall.' },
    { slug: '06-ederis-pallo', name: 'Ederis Pallo', brief: 'Ederis Pallo (captive tax clerk)', kind: 'npc', source: TAX_COLLECTOR, linked: true,
      role: "Captive royal tax clerk carrying the delivery receipt sealed with the King's signet; begs the PCs to destroy it. NPC Core Tax Collector." },
    { slug: '06-hesk-varro', name: 'Hesk Varro', brief: 'Hesk Varro (captive skyfall scavenger)', kind: 'npc', source: GUIDE, linked: true,
      role: 'Captive skyfall scavenger. Offers to guide the PCs to the Lightwardens (#8) or the Annihilator (#21) as payment. NPC Core Guide.' },
    { slug: '06-kael', name: 'Kael', brief: 'Kael (captive horse-clan outrider)', kind: 'npc', source: BANDIT, linked: true,
      role: 'Captive horse-clan outrider; owes the PCs a life-debt. The butchers kill him first. NPC Core Bandit.' },
  ],
  7: [
    { slug: '07-wyvern-queen', name: 'The Wyvern Queen', brief: 'The Wyvern Queen (legendary wyvern)', kind: 'creature', source: WYVERN_QUEEN, linked: true,
      role: 'The wyvern queen. Part one: a flyover; she flees to BR3 at 100 HP or fewer. Part two: she returns 1d4 days later and fights to the death. Use the Diving actor for the swap mid-fight.' },
    { slug: '07-wyvern-queen-diving', name: 'The Wyvern Queen (Diving)', brief: 'The Wyvern Queen (diving)', kind: 'creature', source: WYVERN_QUEEN, linked: true, tokenName: 'The Wyvern Queen',
      role: 'The same wyvern with diving art, for Powerful Dive out of the sun. Same statistics as the Wyvern Queen; swap the token rather than placing both.' },
  ],
  8: [
    { slug: '08-radiant-warden-dormant', name: 'Radiant Warden (Dormant)', brief: 'Radiant warden (dormant)', kind: 'creature', source: RADIANT_WARDEN, linked: true, tokenName: 'Orrery',
      role: 'The warden in its Orrery disguise. Swap to the Active actor when anyone enters the scorched ring or touches the hatch. It powers down if the hatch opens.' },
    { slug: '08-radiant-warden-active', name: 'Radiant Warden (Active)', brief: 'Radiant warden (active)', kind: 'creature', source: RADIANT_WARDEN, linked: true, tokenName: 'Radiant Warden',
      role: 'The warden awake: opens with Radiant Blast, then Radiant Blow to anchor PCs in the ring for the pylons. Same statistics as the Dormant actor.' },
  ],
  9: [
    { slug: '09-iron-juggernaut', name: 'The Iron Juggernaut', brief: 'The Iron Juggernaut', kind: 'creature', source: KM('qKCx4DrEL3vTcNC3'), adjustment: 'elite', linked: true,
      role: 'Elite adamantine golem reflavoured as a tracked hauler. Inexorable March on the trench, Vent as cutting lasers, fists against boarders; Repair Mode at 0 HP.' },
    { slug: '09-brann-kesk', name: 'Brann Kesk', brief: 'Brann Kesk (starving salvager)', kind: 'npc', source: MECHANIC, linked: true,
      role: "Starving salvager in the Juggernaut's hold, three days from death; he dies first. NPC Core Mechanic." },
    { slug: '09-ottilie-kesk', name: 'Ottilie Kesk', brief: 'Ottilie Kesk (starving salvager)', kind: 'npc', source: MECHANIC, linked: true,
      role: "Starving salvager in the hold; she can describe the Annihilator that caught them. NPC Core Mechanic." },
    { slug: '09-tarku', name: 'Tarku', brief: 'Tarku (remains)', kind: 'remains', linked: true,
      role: "A hill-clan hunter delivered a century ago; the longest tally in the hold. His stone-tipped spear, wrapped in a hill-clan charm, is a +3 greater striking spear." },
  ],
  10: [
    { slug: '10-sileth', name: 'Sileth', brief: 'Sileth (Wild Hunt scout)', kind: 'creature', usesGear: true, source: KM('fQ9FuovHuRt6vtcq'), linked: true,
      patch: runeStrike('Crystal Scimitar', ['wounding', 'keen']),
      role: 'Wild Hunt scout hunting anyone carrying royal goods. Gives the PCs one round to run, then fires Befuddle beams and closes with the Crystal Scimitar, whose wounding and keen runes make her quarry bleed and turn a hit on a natural 19 into a critical hit. Calls a truce if half the hunt falls.' },
    { slug: '10-ash-tongue', name: 'Ash-Tongue', brief: 'Ash-Tongue (Wild Hunt hound)', kind: 'creature', source: WILD_HUNT_HOUND, linked: true,
      role: "Wild Hunt hound: Summon Pack on round one, then Knockdown to drop PCs for Sileth's sneak attacks." },
    { slug: '10-thornfoot', name: 'Thornfoot', brief: 'Thornfoot (Wild Hunt hound)', kind: 'creature', source: WILD_HUNT_HOUND, linked: true,
      role: 'Wild Hunt hound working with Ash-Tongue.' },
    { slug: '10-varga-tess', name: 'Varga Tess', brief: 'Varga Tess (dead agent)', kind: 'remains', linked: true,
      role: "The King's agent who poached the white stag; her skeleton lies in the pod with her satchel (900 gp and the stag's last antler tine)." },
  ],
  11: [
    { slug: '11-guthallath', name: 'Guthallath (the Colossus)', brief: 'Guthallath (the Colossus)', kind: 'creature', source: KM('UqUj1IF3vCFuXYqb'), linked: true,
      role: 'The Colossus. Half-awake at Waking Clock 3–5 (two actions, feet stuck in the glass); awake at 6, it smashes the scaffold and opens with Annihilation Beams. Kingmaker guthallath stat block.' },
    { slug: '11-master-engineer-odalric-vane', name: 'Master Engineer Odalric Vane', brief: 'Master Engineer Odalric Vane', kind: 'npc', source: GADGETEER, linked: true,
      role: 'The disgraced salvage-town technician waking the Colossus, and the Influence target. The encounter treats him as level 8; this NPC Core Gadgeteer is level 6 and fits the role better than any level 8 stat block.' },
    { slug: '11-apprentice-hessa', name: 'Apprentice Hessa', brief: 'Apprentice Hessa', kind: 'npc', source: MECHANIC, linked: true,
      role: "One of Vane's apprentices tending the sigils on the scaffold; noncombatant. NPC Core Mechanic." },
    { slug: '11-apprentice-tobin', name: 'Apprentice Tobin', brief: 'Apprentice Tobin', kind: 'npc', source: MECHANIC, linked: true,
      role: "One of Vane's apprentices on the scaffold; noncombatant. NPC Core Mechanic." },
    { slug: '11-apprentice-marro', name: 'Apprentice Marro', brief: 'Apprentice Marro', kind: 'npc', source: MECHANIC, linked: true,
      role: "One of Vane's apprentices, tending the capacitor drums; noncombatant. NPC Core Mechanic." },
  ],
  12: [
    { slug: '12-sard', name: 'The Sard', brief: 'The sard', kind: 'creature', source: B2('eD1kydftMIp4CL2K'), linked: true,
      role: 'Threshold guardian of the Whispering Wood. Warns in Sylvan through the thunder first; fights to the death with Thorn Volley, Trample and Splintering Death.' },
    { slug: '12-foreman-brannock', name: 'Foreman Brannock', brief: 'Foreman Brannock (remains)', kind: 'remains', linked: true,
      role: "Foreman of the logging crew the sard killed. His body lies beside the strongbox holding his ledger and 1,800 gp of wages." },
  ],
  13: [
    { slug: '13-primal-bandersnatch', name: 'Primal Bandersnatch', brief: 'Primal bandersnatch', kind: 'creature', source: KM('hLBHFloWuXLjCQYH'), linked: true,
      role: 'Stalks the PCs through the canyon on the Hunt Clock; at 6 it ambushes with Frumious Charge. Withdraws into the thickets below 100 HP to heal; fights to the death in its den.' },
    { slug: '13-wren-ashby', name: 'Wren Ashby', brief: 'Wren Ashby (remains)', kind: 'remains', linked: true,
      role: "The King's ranger. Only a torn green cloak remains in the den; Wren's bow and pack lie nearby." },
  ],
  14: [
    { slug: '14-speaker', name: 'The Speaker', brief: 'The Speaker (ankou assassin)', kind: 'creature', usesGear: true, source: ANKOU_ASSASSIN, linked: true,
      role: 'Ankou assassin who runs the audience through Telepathy and the Influence target. If it becomes a fight, it uses Shadow Doubles for three actions at once.' },
    { slug: '14-first-ankou', name: 'First Ankou', brief: 'First ankou', kind: 'creature', usesGear: true, source: OZTHOOM,
      role: 'Court ankou. The remaster renamed the Bestiary 2 ankou the ozthoom; this is the Monster Core 2 Ozthoom (level 14). Flies in pairs, flanking for Sneak Attack.' },
    { slug: '14-second-ankou', name: 'Second Ankou', brief: 'Second ankou', kind: 'creature', usesGear: true, source: OZTHOOM,
      role: 'Court ankou (Monster Core 2 Ozthoom, level 14, the remaster name for the ankou).' },
    { slug: '14-third-ankou', name: 'Third Ankou', brief: 'Third ankou', kind: 'creature', usesGear: true, source: OZTHOOM,
      role: 'Court ankou (Monster Core 2 Ozthoom, level 14, the remaster name for the ankou).' },
    { slug: '14-fourth-ankou', name: 'Fourth Ankou', brief: 'Fourth ankou', kind: 'creature', usesGear: true, source: OZTHOOM,
      role: 'Court ankou (Monster Core 2 Ozthoom, level 14, the remaster name for the ankou).' },
    { slug: '14-spared-ankou', name: 'Spared Ankou', brief: 'Spared ankou (optional, from the Shadowless Lodge)', kind: 'creature', usesGear: true, source: ANKOU_ASSASSIN, linked: true,
      role: 'The ankou from the Shadowless Lodge (#1), present only if it escaped. It remembers the PCs by name. Showing a token taken from it lowers the Influence DCs by 2.' },
  ],
  15: [
    { slug: '15-pippet', name: 'Pippet', brief: 'Pippet (whimwyrm)', kind: 'creature', source: WHIMWYRM, linked: true,
      role: 'Dawn-coloured whimwyrm. Loves flattery and hates being ignored (+2 DC if a PC addresses Gloamsy first). Mood starts at 5.' },
    { slug: '15-gloamsy', name: 'Gloamsy', brief: 'Gloamsy (whimwyrm)', kind: 'creature', source: WHIMWYRM, linked: true,
      role: 'Dusk-coloured whimwyrm. Loves dark jokes and hates being touched; a Strike, touch spell or uninvited Interact sets her Mood to 0.' },
  ],
  16: [
    { slug: '16-vilderavn-herald', name: 'The Vilderavn Herald', brief: "The Vilderavn Herald (Trickster Lord's emissary)", kind: 'creature', usesGear: true, source: KM('UXXEOnvp2MDaS9Sc'), linked: true,
      patch: runeStrike('Greatsword', ['greaterBrilliant', 'greaterFearsome']),
      role: "The Trickster Lord's emissary, posing as the Fey Queen's warden. Run as Influence over 4 rounds; in a fight it pulls its punches and withdraws with Forest Step below 100 HP. Its greatsword's greater brilliant and greater fearsome runes add 1d4 fire, and a critical hit leaves the target frightened 2 and risks blinding it (DC 41 Fortitude)." },
    { slug: '16-zomok', name: 'The Zomok', brief: "The Zomok (emissary's mount)", kind: 'creature', source: B2('Ge5Q5I7TTksf7QyN'), linked: true,
      role: "The herald's mount. Entombing Breath on clusters, Swallow Whole on the strongest melee PC." },
  ],
  17: [
    { slug: '17-mu-spore', name: 'The Mu Spore', brief: 'The Mu Spore', kind: 'creature', source: B1('VUJrPHKOjYkIQnWn'), linked: true,
      role: 'Omen of catastrophe anchored above the sinkhole. Opens with Enormous Inhalation; sonic damage stops its regeneration. While three or more corrupted trees stand, its Spores DC rises by 1 and it regains 10 more HP each round.' },
    { slug: '17-court-astrologer', name: 'The Court Astrologer', brief: 'The Court Astrologer (deceased)', kind: 'remains', linked: true,
      role: "The King's astrologer, dead in the hunting blind. The notebook records that \"thunder made it shudder\" (DC 38 Society or Occultism); the satchel holds 2,500 gp and a major healing potion." },
  ],
  18: [
    { slug: '18-vashkra', name: 'Vashkra', brief: 'Vashkra (tor linnorm)', kind: 'creature', source: MC('0H54u83vZ1w3xHcD'), linked: true,
      role: 'Tor linnorm of the pass. Run as Influence over 5 rounds; a fight is for party level 18+. Whoever kills her saves against the Curse of Boiling Blood (DC 48 Will).' },
    { slug: '18-fallen-royal-soldier', name: 'Fallen Royal Soldier', brief: 'Royal Soldier (fallen)', kind: 'remains',
      role: "One of fifty-two royal soldiers in the pass. Their regimental insignia and the King's orders are evidence of royal aggression; their gear yields 800 gp." },
  ],
  19: [
    { slug: '19-black-dragon-sighting', name: 'The Black Dragon (Sighting)', brief: 'The Black Dragon', kind: 'creature', source: BLACK_DRAGON, linked: true,
      tokenName: 'The Black Dragon', portrait: 'portraits/19-black-dragon.webp', token: 'tokens/19-black-dragon-sighting.webp',
      role: 'Before Chapter 10: she circles the spire twice and climbs into the clouds. No combat.' },
    { slug: '19-black-dragon-ambush', name: 'The Black Dragon (Ambush)', brief: 'The Black Dragon', kind: 'creature', source: BLACK_DRAGON, linked: true,
      tokenName: 'The Black Dragon', portrait: 'portraits/19-black-dragon.webp', token: 'tokens/19-black-dragon-ambush.webp',
      role: 'After the PCs fight her in Chapter 10: she rises from the fen, opens with her Breath Weapon down the longest line, and flies to the roost below 100 HP.' },
  ],
  20: [
    { slug: '20-kaldurok', name: 'Kaldurok', brief: 'Kaldurok (lerritan)', kind: 'creature', usesGear: true, source: B2('xfcFXLbadD3KdlHW'), linked: true,
      role: 'Lerritan burning toward Kettle Hollow in the name of its fire demigod. Opens with Volcanic Eruption; fights to the death. Apply the elite adjustment at party level 19.' },
    { slug: '20-elder-maren', name: 'Elder Maren', brief: 'Elder Maren (Kettle Hollow headwoman)', kind: 'npc', source: MAYOR, linked: true,
      role: 'Headwoman of Kettle Hollow, hiding thirty villagers in the grain cellar and well-house. NPC Core Mayor.' },
  ],
  21: [
    { slug: '21-annihilator-robot', name: 'Annihilator Robot', brief: 'Annihilator robot', kind: 'creature', linked: true, custom: annihilator,
      role: 'Burns structures, then growth, then collects survivors in four stasis bays and delivers them to the Iron Juggernaut (#9). Custom conversion from the stat block in the encounter.' },
    { slug: '21-wenna-corl', name: 'Wenna Corl', brief: 'Wenna Corl (goatherd in stasis)', kind: 'npc', source: DROVER, linked: true,
      role: "Goatherd sealed in the Annihilator's bay 1; a PC adjacent to the flank hears her knocking. NPC Core Drover." },
    { slug: '21-aldo-corl', name: 'Aldo Corl', brief: 'Aldo Corl (farmer)', kind: 'npc', source: FARMER, linked: true,
      role: 'Farmer guarding his family in the root cellar. NPC Core Farmer.' },
    { slug: '21-hesk-corl', name: 'Hesk Corl', brief: 'Hesk Corl (grandmother)', kind: 'npc', source: COMMONER, linked: true,
      patch: renameItem('Lore (any one related to their trade)', 'Farming Lore'),
      role: "Aldo's mother, in the root cellar. NPC Core Commoner." },
    { slug: '21-pell-corl', name: 'Pell Corl', brief: 'Pell Corl (son)', kind: 'npc', source: COMMONER, linked: true,
      patch: renameItem('Lore (any one related to their trade)', 'Goatherding Lore'),
      role: 'A boy of about eight, in the root cellar. NPC Core Commoner.' },
    { slug: '21-mira-corl', name: 'Mira Corl', brief: 'Mira Corl (daughter)', kind: 'npc', source: COMMONER, linked: true,
      patch: renameItem('Lore (any one related to their trade)', 'Goatherding Lore'),
      role: 'A girl of about five, in the root cellar. NPC Core Commoner.' },
  ],
};

// Hazards come from the encounter stat blocks; the haunt borrows the skull-ring map icon as art.
const HAZARDS: Record<number, Spec[]> = {
  5: [{ slug: '05-lament-of-the-wall', name: 'Lament of the Wall', kind: 'hazard', linked: true,
    custom: lament, portrait: 'map-icons/05-ossuary-wall.webp', token: 'map-icons/05-ossuary-wall.webp',
    role: 'Level 15 complex haunt that joins the skulltaker fight. Drop it for a Moderate threat (80 XP); at party level 18 raise it to level 17 (DCs +3).' }],
  8: [{ slug: '08-defence-pylon', name: 'Hull Defence Grid', brief: 'Defence pylon', kind: 'hazard', custom: defenceGrid,
    role: 'Complex hazard 16 (40 XP). Place one token per pylon (three); each unlinked token tracks its own pylon HP. Disabling all three opens the hatch, which powers down the warden.' }],
};

const CHEST = 'icons/containers/chest';

// Treasure lying at a site rather than on a body; the scene seeds each cache's token hidden.
const CACHES: Record<number, Spec[]> = {
  1: [
    { slug: '01-scouts-pay-chest', name: "Scouts' Pay Chest", kind: 'cache', stowed: true, icon: `${CHEST}/chest-reinforced-steel-green.webp`,
      role: "The scouts' pay chest in the bunkroom." },
    { slug: '01-gun-cabinet', name: "The Baron's Gun Cabinet", kind: 'cache', stowed: true, icon: `${CHEST}/chest-reinforced-steel-walnut-brown.webp`,
      role: "The baron's locked gun cabinet in the great hall." },
  ],
  3: [
    { slug: '03-barrow-grave-goods', name: 'Barrow Grave Goods', kind: 'cache', icon: `${CHEST}/chest-reinforced-stone.webp`,
      role: "Hill-clan torcs among the bones and armour on the barrow floor, near the bones of the troll's mother." },
  ],
  4: [
    { slug: '04-varrold-strongbox', name: 'Varrold Strongbox', kind: 'cache', stowed: true, icon: `${CHEST}/chest-simple-steel-brown.webp`,
      role: "The Varrold family's strongbox, hidden in the ruined manor with the family silver." },
    { slug: '04-athach-trophies', name: "Athaches' Trophies", kind: 'cache', icon: 'icons/commodities/bones/bones-stack-brown.webp',
      role: "The athaches' trophy pile in the manor rubble, among them a dead knight's arms." },
  ],
  5: [
    { slug: '05-chieftains-chamber', name: "Chieftain's Chamber", kind: 'cache', stowed: true, icon: `${CHEST}/chest-worn-oak-tan.webp`,
      role: 'The burial chamber beneath the fallen standing stone. It opens once the skulltaker is destroyed and the haunt laid to rest.' },
    { slug: '05-antiquarians-camp', name: "Antiquarians' Camp", kind: 'cache', icon: 'icons/containers/bags/pack-canvas-white-brown.webp',
      role: "The antiquarians' tents outside the wall, with their packs and sketchbooks." },
  ],
  6: [
    { slug: '06-smokehouse-stores', name: 'Smokehouse Stores', kind: 'cache', icon: 'icons/containers/boxes/crates-wooden-stacked.webp',
      role: 'Coin, silver plate and trade goods the butchers piled in the smokehouse.' },
  ],
  7: [
    { slug: '07-huntmasters-shield', name: "Huntmaster's Shield", kind: 'cache', icon: 'icons/equipment/shield/heater-steel-worn.webp',
      role: "Buried in the shale near the cliff. The Wyvern Queen's own treasure lies in her lair at BR3." },
  ],
  8: [
    { slug: '08-hull-cache', name: 'Hull Cache', kind: 'cache', stowed: true, icon: `${CHEST}/chest-tech-silver.webp`,
      role: 'Inside the hull, behind the hatch: DC 38 Thievery or Crafting, or open once all three pylons are disabled.' },
  ],
  11: [
    { slug: '11-vanes-wagon', name: "Vane's Wagon", kind: 'cache', icon: 'icons/containers/boxes/crate-wooden-brown.webp',
      role: "Vane's covered wagon at the crater's rim, holding his notes, tools and the last of the King's gold." },
  ],
  12: [
    { slug: '12-brannocks-strongbox', name: "Brannock's Strongbox", kind: 'cache', stowed: true, icon: `${CHEST}/chest-reinforced-steel-brown.webp`,
      role: "Iron, half-buried beside the foreman's tent, 40 feet from the sard. Unlocking it takes a DC 34 Thievery check; prying it open takes a DC 36 Athletics check." },
  ],
  14: [
    { slug: '14-royal-scouts-cloak', name: "Royal Scout's Cloak", kind: 'cache', stowed: true, icon: 'icons/equipment/back/cloak-layered-green.webp',
      role: 'One of the empty ankou cloaks in the branches bears the badge of a royal scout. A waxed packet hides in its lining.' },
  ],
  15: [
    { slug: '15-picnic-remains', name: 'Picnic Remains', kind: 'cache', icon: 'icons/containers/kitchenware/goblet-engraved-grey.webp',
      role: "The ruined banquet table from the King's visit." },
  ],
  18: [
    { slug: '18-vashkras-hoard', name: "Vashkra's Hoard", kind: 'cache', icon: `${CHEST}/chest-small-gold-cherry.webp`,
      role: 'Reached through the magma vent: fire resistance or a DC 40 Athletics check to swim through it.' },
  ],
  19: [
    { slug: '19-black-dragon-roost', name: "The Black Dragon's Roost", kind: 'cache', icon: 'icons/commodities/bones/bones-dragon-grey.webp',
      role: 'Her old cache on the ledge near the top of the spire (DC 38 Athletics to climb). The PCs find it at the sighting, before Chapter 10.' },
  ],
};

interface Gear { from: string; name?: string; quantity?: number; note?: string; runes?: Runes; material?: { type: string; grade: string }; size?: string }
/** An item the holder's stat block already carries, made treasure in place so its strike stays linked. */
interface Stock { stock: string; name?: string; note?: string; runes?: Runes }
interface Valuable { name: string; gp: number; category: 'art-object' | 'gem' | 'material'; img: string; note: string; bulk: number }
interface Keepsake { name: string; img: string; note: string; quantity: number }
interface Scroll { spell: string; rank: number }
type Loot = Gear | Stock | Valuable | Keepsake | Scroll;

// PF2e equipment-srd ids.
const GOLD = 'B6B7tBWJSqOBz5zz';
const ARQUEBUS = 'ChTaE7jhvCjcS6jI';
const ARTIFICER_SPECTACLES = 'VVymhIF6UBThdHP9';
const BRACERS_OF_STRENGTH = 'WOiCJSS2MicKCMVs';
const COMPOSITE_LONGBOW = 'dUC8Fsa6FZtVikS3';
const FULL_PLATE = 'Gq1cZWSKOtJhKd2p';
const GREATAXE = '8COlYvHe6hKCXY8x';
const GREATER_BOTTLED_LIGHTNING = 'r2iTRbt1zpkAqHj2';
const GREATER_DAREDEVIL_BOOTS = 'kjFFmqci69k2zMXF';
const HALBERD = 'dgWxsYm0DWHb27h6';
const DRILL_MARK_III = 'vkYWqXrHdUAggJIg';
const LONGSWORD = 'LJdbVTOZog39EEbi';
const MAJOR_EAGLE_EYE_ELIXIR = 'kicNrnZz1KjJYRVI';
const MAJOR_ELIXIR_OF_LIFE = 'AmxSqEoFhRLMYd1W';
const MAJOR_HEALING_POTION = 'p3ppzFSsZXFRe3H8';
const MAJOR_OBSIDIAN_GOGGLES = 'rXXNw6dwVn96giDi';
const MAJOR_STURDY_SHIELD = 'BWQzaHbGVqlBuMww';
const MAJOR_UNMEMORABLE_MANTLE = 'HcjEb07UjWchysx5';
const SPEAR = 'tOhoGvmCMw4JpWcS';
const STEEL_SHIELD = 'Yr9yCuJiAlFh3QEB';
const STERLING_ARTISANS_TOOLKIT = '0QgniSjpzksm5riV';
const TROUBADOURS_CAP = 'h7OCAvvnUnCIM9Aj';
const TRUESIGHT_POTION = 'CoMwPsQ8mPj5Evti';
// PF2e spells-srd ids.
const REGENERATE = '2Vkd1IxylPceUAAF';

const gear = (from: string, edit: Omit<Gear, 'from'> = {}): Gear => ({ from, ...edit });
const coins = (gp: number): Gear => gear(GOLD, { quantity: gp });
const stock = (name: string, edit: Omit<Stock, 'stock'> = {}): Stock => ({ stock: name, ...edit });
const art = (name: string, gp: number, img: string, note: string, bulk = 0): Valuable => ({ name, gp, category: 'art-object', img, note, bulk });
const gems = (name: string, gp: number, img: string, note: string, bulk = 0): Valuable => ({ name, gp, category: 'gem', img, note, bulk });
const material = (name: string, gp: number, img: string, note: string, bulk = 0): Valuable => ({ name, gp, category: 'material', img, note, bulk });
const keepsake = (name: string, img: string, note: string, quantity = 1): Keepsake => ({ name, img, note, quantity });
const scroll = (spell: string, rank: number): Scroll => ({ spell, rank });

const DOC = 'icons/sundries/documents';
const RUNES_2_GREATER_STRIKING = { potency: 2, striking: 2, property: [] };
const RUNES_3_GREATER_STRIKING = { potency: 3, striking: 2, property: [] };
// The butchers' stock weapons have empty rune slots: bleed suits butchers, and their hatchets are thrown.
const WOUNDING = { property: ['wounding'] };
const RETURNING = { property: ['returning'] };
const LARGE = 'Sized for a Large creature: sell it or resize it.';

// Each encounter's Rewards, keyed by the actor that holds them. Creatures and NPCs carry what they
// own and become lootable on death; remains and caches hold what lies at the site.
const TREASURE: Record<string, Loot[]> = {
  '01-ankou': [
    keepsake('Cold Iron Feather', 'icons/commodities/materials/feather-black-blue.webp', "A feather from the ankou's wing, won by killing it."),
  ],
  '01-felgo': [
    keepsake("Royal Scouts' Kit", 'icons/containers/bags/pack-leather-brown.webp', 'Bedrolls, rope, rations and spare green cloaks for six scouts.'),
  ],
  '01-scouts-pay-chest': [coins(550), gear(MAJOR_HEALING_POTION)],
  '01-gun-cabinet': [
    gear(ARQUEBUS, { name: "The Baron's Hunting Arquebus", runes: { potency: 2, striking: 2, property: ['greaterThundering'] },
      note: "The baron's hunting gun, with an antler-inlaid stock." }),
  ],
  '02-maestra-ilsabet-rova': [
    stock("Lyre (Moderate Maestro's Instrument)", { name: "Violin (Moderate Maestro's Instrument)" }),
    coins(120),
    art('Gold Court Brooch', 180, 'icons/commodities/treasure/brooch-gold-ruby.webp', 'Royal court jewellery, worn on ruined velvet.'),
  ],
  '02-daro-vesk': [
    coins(80),
    art('Silver Signet Ring', 120, 'icons/equipment/finger/ring-band-engraved-scrolls-silver.webp', 'Engraved with the crest of the Royal Academy.'),
  ],
  '02-olenna-fair': [
    coins(80),
    art('Pearl Earrings', 120, 'icons/commodities/treasure/pearl-shell.webp', 'A gift from the royal court.'),
  ],
  '02-pell-composer': [
    coins(50),
    art('Garnet Ring', 150, 'icons/equipment/finger/ring-cabochon-gold-red.webp', "His mother's, worn on a cord because it no longer fits his wasted finger."),
  ],
  '03-ser-halward-toll': [
    keepsake("King's Letter of Offer", `${DOC}/document-sealed-signatures-red.webp`, "The King's offer to the troll, under his seal: evidence of his habit of sending envoys to monsters."),
    coins(400),
    gear(GREATER_BOTTLED_LIGHTNING),
  ],
  '03-barrow-grave-goods': [
    art('Ancient Hill-Clan Torcs', 1200, 'icons/equipment/neck/choker-chain-thick-gold.webp', 'Gold neck-rings from the barrow floor.', 1),
  ],
  '04-varrold-strongbox': [
    coins(1000),
    art('Varrold Family Silver', 600, 'icons/containers/kitchenware/goblet-engraved-lines-grey.webp', 'Candlesticks, plate and a christening cup marked with the Varrold crest.', 2),
  ],
  '04-athach-trophies': [
    gear(HALBERD, { name: "Dead Knight's Halberd", runes: RUNES_2_GREATER_STRIKING }),
    gear(MAJOR_STURDY_SHIELD, { note: "The same knight's shield, dented by athach fists." }),
  ],
  '05-chieftains-chamber': [
    art("Chieftain's Gold Torc and Grave Goods", 2400, 'icons/commodities/treasure/crown-gold-laurel-wreath.webp', 'A heavy gold torc, amber beads and bronze vessels.', 2),
    gear(BRACERS_OF_STRENGTH, { note: "Bronze arm-rings from the hill-clan chieftain's grave." }),
  ],
  '05-antiquarians-camp': [
    gear(MAJOR_HEALING_POTION, { quantity: 2 }),
    art("Antiquarians' Sketchbooks", 300, 'icons/sundries/books/book-backed-wood-tan.webp', "Drawings of the fort and notes on the chieftain's burial chamber. Worth 300 gp to any scholar; returning them to the Academy earns +1 to the kingdom's next Culture check after the King's city falls.", 1),
  ],
  '06-grosh': [
    stock('Battle Axe', { name: "Grosh's Battle Axe", runes: WOUNDING, note: LARGE }),
    stock('Hatchet', { runes: RETURNING, note: LARGE }),
  ],
  '06-murla': [stock('Battle Axe', { runes: WOUNDING, note: LARGE }), stock('Hatchet', { runes: RETURNING, note: LARGE })],
  '06-tuk': [stock('Battle Axe', { runes: WOUNDING, note: LARGE }), stock('Hatchet', { runes: RETURNING, note: LARGE })],
  '06-hobb': [stock('Battle Axe', { runes: WOUNDING, note: LARGE }), stock('Hatchet', { runes: RETURNING, note: LARGE })],
  '06-ederis-pallo': [
    keepsake('Delivery Receipt', `${DOC}/document-sealed-red-tan.webp`, "Sealed with the King's signet: proof of his arrangement with the Giant Lord. It grants a +2 circumstance bonus to one Kingdom check or Liberation activity tied to the city's nobility."),
  ],
  '06-smokehouse-stores': [
    coins(500),
    art('Silver Plate', 400, 'icons/containers/kitchenware/goblet-engraved-vines-grey.webp', 'Looted from royal caravans.', 2),
    material('Trade Goods', 300, 'icons/containers/boxes/crate-wooden-beige.webp', 'Bolts of cloth, spices and salt.', 4),
  ],
  '07-huntmasters-shield': [
    gear(STEEL_SHIELD, { name: "Huntmaster's Shield", note: "It bears the King's household crest. Returning it to the huntmaster's widow in the King's city after liberation earns goodwill among the city's old families." }),
  ],
  '08-radiant-warden-active': [
    material('Warden Core', 1500, 'icons/commodities/tech/battery-arcane-crystal-cube.webp', 'Worth 1,500 gp to skyfall buyers, or kept as a kingdom curiosity. If the hatch opened first, salvage it from the powered-down warden.', 2),
  ],
  '08-hull-cache': [
    material('Skymetal Stock', 2000, 'icons/commodities/metal/ingot-stack-teal.webp', 'Orichalcum and adamantine bar stock.', 2),
    gear(ARTIFICER_SPECTACLES, { note: 'Skyfall lenses on a brass headband.' }),
    gear(TRUESIGHT_POTION),
    gear(MAJOR_ELIXIR_OF_LIFE),
  ],
  '09-iron-juggernaut': [
    material('Adamantine Plating', 3000, 'icons/commodities/metal/armor-plate-reticulated.webp', 'Raw metal stripped from the destroyed or disabled hauler.', 6),
  ],
  '09-brann-kesk': [
    gear(STERLING_ARTISANS_TOOLKIT, { name: "The Kesks' Salvage Tools" }),
  ],
  '09-tarku': [
    gear(SPEAR, { name: "Tarku's Spear", runes: RUNES_3_GREATER_STRIKING, note: 'Stone-tipped and wrapped in a hill-clan charm, found among the bones in the hold.' }),
  ],
  '10-varga-tess': [
    coins(900),
    material("White Stag's Antler Tine", 1500, 'icons/commodities/bones/horn-antler-pink-white.webp', 'The last tine of the stag the Wild Hunt was chasing. Worth 1,500 gp to a druid or as a primal component.', 0.1),
  ],
  '10-sileth': [
    gear(MAJOR_EAGLE_EYE_ELIXIR, { note: "Taken from Varga's satchel." }),
    gear(GREATER_DAREDEVIL_BOOTS, { note: 'A trophy Sileth took from an earlier victim of the Hunt.' }),
  ],
  '11-guthallath': [
    material('Guthallath Core', 3500, 'icons/commodities/tech/cog-gear-steel-glass.webp', 'Standard-grade adamantine and skymetal circuitry, worth 3,500 gp to a smith or to skyfall traders. Salvaging it also grants 1 Commodity each of Ore and Luxuries.', 4),
  ],
  '11-vanes-wagon': [
    coins(2000),
    keepsake("Vane's Notebook", 'icons/sundries/books/book-embossed-steel-brown.webp', `Holds the formula for the @UUID[Compendium.pf2e.equipment-srd.Item.${DRILL_MARK_III}]{siege drill (Mark III)}, a level 16 construct-driven drill.`),
  ],
  '12-sard': [
    material('Sard Heartwood Shard', 3000, 'icons/commodities/wood/log-cut-petrified-violet.webp', 'Works as a level 17 magic item component worth 3,000 gp.', 1),
  ],
  '12-foreman-brannock': [
    gear(GREATAXE, { name: "Brannock's Cold Iron Greataxe", material: { type: 'cold-iron', grade: 'high' }, note: "High-grade cold iron, found in the foreman's tent." }),
  ],
  '12-brannocks-strongbox': [
    coins(1800),
    keepsake("Brannock's Ledger", 'icons/sundries/books/book-simple-brown.webp', "The logging crew's wages and tallies, in the foreman's hand."),
  ],
  '13-primal-bandersnatch': [
    material('Bandersnatch Pelt and Quills', 2500, 'icons/commodities/leather/fur-pelt-spotted-brown.webp', 'Prized by fletchers. A pelt in the throne room grants +1 Fame once.', 4),
  ],
  '13-wren-ashby': [
    gear(COMPOSITE_LONGBOW, { name: "Wren's Bow", runes: { potency: 2, striking: 2, property: ['speed'] } }),
    keepsake("Wren's Journal", 'icons/sundries/books/book-notes-ragged-green.webp', 'Maps two hidden trails in the Whispering Wood and records a meeting with a raven-masked fey.'),
    art("Troll King's Crown", 1500, 'icons/equipment/head/crown-horns-brown.webp', 'Found among the bones in the den.', 1),
  ],
  '14-speaker': [
    keepsake('Black Feather', 'icons/commodities/materials/feather-black-blue.webp', 'The Speaker gives it at Influence 7. Showing it once to any ankou prevents that ankou from attacking for one encounter.'),
  ],
  '14-royal-scouts-cloak': [
    gems('Waxed Packet of Gems', 1200, 'icons/commodities/gems/gem-cluster-blue-white.webp', "Sewn into the lining of a royal scout's cloak."),
    scroll(REGENERATE, 7),
  ],
  '15-pippet': [
    gear(MAJOR_UNMEMORABLE_MANTLE, { note: "A mantle of rose-gold scales: Pippet's gift when her Mood reaches 10." }),
  ],
  '15-gloamsy': [
    gear(TROUBADOURS_CAP, { note: "A jester's cap from the King's court, now enchanted: Gloamsy's gift when her Mood reaches 10." }),
  ],
  '15-picnic-remains': [
    art("King's Silver Service", 1000, 'icons/containers/kitchenware/goblet-jeweled-gold-white.webp', 'Plates, goblets and cutlery engraved with his monogram.', 2),
  ],
  '16-vilderavn-herald': [
    gear(FULL_PLATE, { name: "The Herald's Black Full Plate", runes: { potency: 2, resilient: 2, property: [] }, note: 'Taken only if the herald dies.' }),
    keepsake('Black Raven Feather', 'icons/commodities/materials/feather-black-blue.webp', "The herald's token at Influence 6. Once, a creature holding it may ask the Trickster Lord's court a single question in Chapter 11, or it may serve as safe passage past one fey guardian loyal to the Trickster Lord (GM's choice)."),
  ],
  '16-zomok': [
    material('Zomok Heartwood', 3000, 'icons/commodities/wood/log-rough-petrified-white.webp', 'A crafting reagent for a primal item.', 2),
  ],
  '17-mu-spore': [
    material('Mu Spore Core Sac', 4000, 'icons/commodities/biological/organ-bladder-red.webp', 'Harvesting it takes a DC 40 Crafting or Nature check. Worth 4,000 gp as an alchemical reagent.', 2),
  ],
  '17-court-astrologer': [
    coins(2500),
    gear(MAJOR_HEALING_POTION),
    keepsake("Astrologer's Notebook", 'icons/sundries/books/book-eye-purple.webp', 'Records that "thunder made it shudder" (DC 38 Society or Occultism), and names three more omens the astrologer charted.'),
  ],
  '18-fallen-royal-soldier': [
    material("Soldiers' Gear", 800, 'icons/commodities/metal/mail-plate-steel.webp', 'Arms and armour salvaged from the fifty-two dead.', 8),
    keepsake('Regimental Insignia', 'icons/commodities/treasure/medal-ribbon-gold-red.webp', 'Evidence of royal aggression.'),
    keepsake("King's Orders", `${DOC}/document-official-capital.webp`, "The regiment's original orders, under the King's seal: evidence of royal aggression."),
  ],
  '18-vashkras-hoard': [
    gems('Obsidian, Silver and Gems', 9000, 'icons/commodities/gems/gem-rough-ball-purple.webp', "Vashkra's hoard.", 3),
    gear(MAJOR_OBSIDIAN_GOGGLES),
  ],
  '19-black-dragon-ambush': [
    art('Horn Ornaments', 3000, 'icons/commodities/treasure/horn-carved-banded.webp', 'Banded gold she wears on her horns; her hoard stays in the fey realm.', 1),
  ],
  '19-black-dragon-roost': [
    coins(2000),
    gear(LONGSWORD, { name: 'Acid-Etched Longsword', runes: { potency: 3, striking: 2, property: ['corrosive'] }, note: 'Corroded but intact.' }),
  ],
  '20-kaldurok': [
    stock('+3 Greater Striking Warhammer', { name: "Kaldurok's Obsidian Warhammer", runes: { property: ['flaming'] },
      note: 'Sized for a Gargantuan creature: sell it or resize it.' }),
    material('Volcanic Glass Skin', 6000, 'icons/commodities/stone/ore-chunk-magma-brown.webp', 'Usable as a crafting reagent.', 8),
  ],
  '20-elder-maren': [coins(500)],
  '21-annihilator-robot': [
    keepsake('Annihilator Chain Gun', 'icons/commodities/tech/blade-mechanical-cutter.webp', 'Functions as a level 16 integrated firearm only while wired to a power source.', 2),
    material('Stasis-Bay Power Cell', 2000, 'icons/commodities/tech/battery-fuel-cell-teal.webp', 'Worth 2,000 gp to skyfall buyers.', 2),
    material('Salvage Plating', 1500, 'icons/commodities/metal/plate-curved-brass.webp', 'Stripped from the wreck.', 4),
  ],
};

const ACTION_IMG = {
  1: 'systems/pf2e/icons/actions/OneAction.webp',
  2: 'systems/pf2e/icons/actions/TwoActions.webp',
  reaction: 'systems/pf2e/icons/actions/Reaction.webp',
  passive: 'systems/pf2e/icons/actions/Passive.webp',
} as const;

const MIGRATION = { version: 0.959, previous: null };
let stats: Json = {};

function publication(title: string, license: 'OGL' | 'ORC' = 'ORC'): Json {
  return { license, remaster: true, title };
}
const ITEM_PUBLICATION = { license: 'OGL', remaster: false, title: '' };

function action(
  actorId: string,
  key: string,
  name: string,
  cost: 1 | 2 | 'reaction' | 'passive',
  description: string,
  opts: { category?: string; traits?: string[]; rules?: Json[] } = {},
): Json {
  const _id = stableId(`item:${key}:${name}`);
  return {
    _id,
    _key: `!actors.items!${actorId}.${_id}`,
    img: ACTION_IMG[cost],
    name,
    type: 'action',
    sort: 0,
    system: {
      actionType: { value: typeof cost === 'number' ? 'action' : cost },
      actions: { value: typeof cost === 'number' ? cost : null },
      category: opts.category ?? (cost === 'passive' || cost === 'reaction' ? 'defensive' : 'offensive'),
      description: { value: description },
      publication: ITEM_PUBLICATION,
      rules: opts.rules ?? [],
      slug: null,
      traits: { rarity: 'common', value: opts.traits ?? [] },
      _migration: MIGRATION,
    },
    effects: [],
    _stats: { ...stats, compendiumSource: null },
  };
}

function strike(
  actorId: string,
  key: string,
  name: string,
  bonus: number,
  damage: string,
  damageType: string,
  traits: string[],
  opts: { range?: Json | null; description?: string; subjectToMAP?: boolean } = {},
): Json {
  const _id = stableId(`item:${key}:${name}`);
  return {
    _id,
    _key: `!actors.items!${actorId}.${_id}`,
    img: 'systems/pf2e/icons/default-icons/melee.svg',
    name,
    type: 'melee',
    sort: 0,
    system: {
      attack: { value: '' },
      attackEffects: { custom: '', value: [] },
      bonus: { value: bonus },
      damageRolls: { [stableId(`damage:${key}:${name}`).toLowerCase()]: { damage, damageType } },
      description: { value: opts.description ?? '' },
      publication: ITEM_PUBLICATION,
      range: opts.range ?? null,
      rules: [],
      slug: null,
      ...(opts.subjectToMAP === false ? { subjectToMAP: false } : {}),
      traits: { rarity: 'common', value: traits },
      _migration: MIGRATION,
    },
    effects: [],
    _stats: { ...stats, compendiumSource: null },
  };
}

function annihilator(id: string): Json {
  const k = '21-annihilator-robot';
  const items = [
    strike(id, k, 'Claw', 34, '3d12+16', 'slashing', ['reach-20']),
    strike(id, k, 'Chain Gun', 32, '3d10+12', 'piercing', ['deadly-d12'], { range: { increment: 200, max: null } }),
    action(id, k, 'Force Field', 'passive',
      "<p>The annihilator projects a shimmering field with 60 Hit Points. Damage reduces the field before the robot's HP. At the start of each of its turns, the field regains 15 HP. If the field drops to 0, it collapses and can't recover for [[/gmr 1d4 #rounds]]{1d4 rounds}; then it returns at 15 HP.</p><p>Each electricity hit that deals 15 or more damage also stuns the Force Field: it doesn't regain HP at the start of the annihilator's next turn.</p>"),
    action(id, k, 'Suppressed Response', 'reaction',
      '<p><strong>Trigger</strong> A creature within 120 feet critically hits the annihilator.</p><hr /><p><strong>Effect</strong> The annihilator makes a chain gun Strike against the triggering creature.</p>'),
    action(id, k, 'Booster Jets', 1,
      "<p>The annihilator gains a fly speed of 60 feet until the end of its next turn. It can't use Booster Jets again for 1 round.</p>",
      { category: 'interaction', traits: ['move'] }),
    action(id, k, 'Combined Arms', 2,
      '<p>The annihilator makes a claw Strike and a chain gun Strike, each at its current multiple attack penalty; the penalty increases after both.</p>'),
    action(id, k, 'Plasma Lance', 2,
      "<p>The tail projects a @Template[line|distance:120] of plasma. Each creature in the line takes @Damage[(9d6)[fire],(9d6)[electricity]] damage (@Check[reflex|dc:40|basic]). The annihilator can't use Plasma Lance again for [[/gmr 1d4 #rounds]]{1d4 rounds}.</p>",
      { traits: ['electricity', 'fire'] }),
    action(id, k, 'Suppressing Fire', 2,
      '<p>The chain guns sweep a @Template[cone|distance:60]. Each creature in the area takes @Damage[6d12[piercing]] damage (@Check[reflex|dc:38|basic]). A creature that fails is @UUID[Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg]{Off-Guard} until the end of its next turn.</p>'),
    action(id, k, 'Collect Specimen', 1,
      "<p>The annihilator picks up an unconscious or dying creature within its reach and seals them in a stasis bay. The creature stops making recovery checks and its dying value can't increase while inside. Opening a bay takes two Interact actions and a @Check[thievery|dc:38] check, or destroying the annihilator. A bay holds one creature; the annihilator has four bays.</p>",
      { category: 'interaction', traits: ['manipulate'] }),
    action(id, k, 'Deliver Cargo', 'passive',
      "<p>When two or more bays are full, or when the annihilator drops below 100 HP, it uses Booster Jets and leaves for the Juggernaut's docking cradle. It reaches the cradle in 8 hours and transfers every captive into the Juggernaut's hold, where stasis ends.</p>",
      { category: 'interaction' }),
  ];
  items.forEach((item, i) => (item.sort = (i + 1) * 100000));
  return {
    type: 'npc',
    items,
    system: {
      abilities: { str: { mod: 9 }, dex: { mod: 3 }, con: { mod: 7 }, int: { mod: 2 }, wis: { mod: 2 }, cha: { mod: -5 } },
      attributes: {
        ac: { value: 42, details: '' },
        adjustment: null,
        allSaves: { value: '' },
        hp: { value: 300, max: 300, temp: 0, details: '' },
        immunities: ['bleed', 'cold', 'death-effects', 'disease', 'doomed', 'drained', 'fatigued', 'paralyzed', 'poison', 'sickened', 'unconscious'].map((type) => ({ type })),
        weaknesses: [{ type: 'critical-hits', value: 15 }, { type: 'electricity', value: 15 }],
        resistances: [{ type: 'fire', value: 15 }],
        speed: { value: 50, otherSpeeds: [{ type: 'climb', value: 30 }], details: 'booster jets' },
      },
      details: {
        blurb: 'Skyfall war machine',
        languages: { value: ['common'], details: 'antique machine dialect' },
        level: { value: 18 },
        privateNotes: '',
        publicNotes: "<p>An annihilator robot ranges out of the Skyfall Wastes on orders older than any living nation: burn structures, destroy growth, and collect survivors. It carries captives in four stasis bays and brings them to the docking cradle on the Iron Juggernaut's loop, where it transfers them into the Juggernaut's hold.</p>",
        publication: publication('Points of Interest (conversion of the Pathfinder RPG annihilator robot)', 'OGL'),
      },
      initiative: { statistic: 'perception' },
      perception: {
        details: '',
        mod: 32,
        senses: [{ type: 'darkvision' }, { type: 'low-light-vision' }, { type: 'tremorsense', acuity: 'imprecise', range: 60 }],
      },
      resources: {},
      saves: { fortitude: { value: 33, saveDetail: '' }, reflex: { value: 28, saveDetail: '' }, will: { value: 27, saveDetail: '' } },
      skills: { acrobatics: { base: 30 }, athletics: { base: 36 }, intimidation: { base: 29 } },
      traits: { rarity: 'rare', size: { value: 'grg' }, value: ['construct', 'robot'] },
      _migration: MIGRATION,
    },
  };
}

function lament(): Json {
  return {
    type: 'hazard',
    items: [],
    system: {
      attributes: {
        ac: { value: 10 },
        emitsSound: 'encounter',
        hardness: 0,
        hasHealth: false,
        hp: { details: '', max: 0, temp: 0, tempmax: 0, value: 0 },
        immunities: [],
        stealth: { details: '<p>(expert) to notice the whispering begin before it rises</p>', value: 29 },
      },
      details: {
        description: '<p>Thousands of skulls scream their old grievances in unison.</p>',
        disable: '<p>@Check[religion|dc:36] to recite the funeral rites of the hill-clan dead (three successes required), or @Check[diplomacy|dc:39] or Hill-Clan Lore to promise the bones their chieftain will be honoured (two successes). Destroying the skulltaker also ends the haunt.</p>',
        isComplex: true,
        level: { value: 15 },
        publication: publication('Points of Interest'),
        reset: '<p>The haunt resets at the next dusk.</p>',
        routine: "<p>(1 action) The wall screams. Each living creature within the ring attempts a @Check[will|dc:36] save.</p><p><strong>Critical Success</strong> No effect.</p><p><strong>Success</strong> @UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened 1}.</p><p><strong>Failure</strong> @UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened 2}, and the creature can't reduce its frightened value below 1 while inside the ring.</p><p><strong>Critical Failure</strong> As failure, and the creature is @UUID[Compendium.pf2e.conditionitems.Item.sDPxOjQ9kx2RZE8D]{Fleeing} for 1 round.</p>",
      },
      saves: { fortitude: { saveDetail: '', value: 0 }, reflex: { saveDetail: '', value: 0 }, will: { saveDetail: '', value: 0 } },
      statusEffects: [],
      traits: { rarity: 'unique', size: { value: 'grg' }, value: ['haunt'] },
      _migration: MIGRATION,
    },
  };
}

function defenceGrid(id: string): Json {
  const k = '08-defence-pylon';
  const items = [
    action(id, k, 'Lock-On', 'reaction',
      '<p><strong>Trigger</strong> A creature enters the scorched ring.</p><hr /><p><strong>Effect</strong> The grid rolls initiative.</p>'),
    strike(id, k, 'Laser', 31, '4d10+14', 'fire', [], {
      subjectToMAP: false,
      description: '<p>Ranged. Each working pylon fires once per round at a random creature in the scorched ring. On a critical hit the target is also @UUID[Compendium.pf2e.conditionitems.Item.TkIyaNPgTZFBCCuh]{Dazzled} until the end of its next turn.</p>',
    }),
  ];
  items.forEach((item, i) => (item.sort = (i + 1) * 100000));
  return {
    type: 'hazard',
    items,
    system: {
      attributes: {
        ac: { value: 39 },
        emitsSound: 'encounter',
        hardness: 20,
        hasHealth: true,
        hp: { details: 'per pylon (BT 40)', max: 80, temp: 0, tempmax: 0, value: 80 },
        immunities: ['critical-hits', 'object-immunities', 'precision'].map((type) => ({ type })),
        stealth: { details: "<p>(expert); @Check[perception|dc:38] to notice the pylons' tracking lenses before entering the scorched ring</p>", value: 30 },
      },
      details: {
        description: '<p>Three pylons fire laser bursts at intruders inside the scorched ring.</p>',
        disable: "<p>@Check[thievery|dc:38|traits:action:disable-a-device] or @Check[crafting|dc:40] to disable one pylon; a @Check[society|dc:36] or @Check[crafting|dc:36] check to read the hull's glyphs reduces the remaining pylons' Disable DCs by 2.</p>",
        isComplex: true,
        level: { value: 16 },
        publication: publication('Points of Interest'),
        reset: '<p>The grid resets 1 hour after no creatures remain in the ring.</p>',
        routine: '<p>(one action per working pylon) Each working pylon fires a laser at a random creature in the ring.</p>',
      },
      saves: { fortitude: { saveDetail: '', value: 30 }, reflex: { saveDetail: '', value: 24 }, will: { saveDetail: '', value: 0 } },
      statusEffects: [],
      traits: { rarity: 'unique', size: { value: 'med' }, value: ['electricity', 'fire', 'mechanical', 'trap'] },
      _migration: MIGRATION,
    },
  };
}

function lootActor(): Json {
  return {
    type: 'loot',
    items: [],
    system: {
      details: { description: '', level: { value: 0 } },
      lootSheetType: 'Loot',
      hiddenWhenEmpty: false,
      _migration: MIGRATION,
    },
  };
}

const TOKEN_SQUARES: Record<string, number> = { tiny: 1, sm: 1, med: 1, lg: 2, huge: 3, grg: 4 };

const html = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LIMITED = 1;

/** A valuable or keepsake of our own, which the stub carries. */
function ownItem(loot: Valuable | Keepsake, actorId: string, slug: string): Json {
  const valuable = 'gp' in loot;
  const _id = ids.item(slug, loot.name);
  return {
    _id,
    _key: `!actors.items!${actorId}.${_id}`,
    name: loot.name,
    type: valuable ? 'treasure' : 'equipment',
    img: loot.img,
    system: {
      baseItem: null,
      bulk: { value: valuable ? loot.bulk : 0 },
      ...(valuable ? { category: loot.category } : { usage: { value: 'held-in-one-hand' } }),
      containerId: null,
      description: { value: `<p>${html(loot.note)}</p>` },
      hardness: 0,
      hp: { max: 0, value: 0 },
      level: { value: 0 },
      material: { grade: null, type: null },
      price: { value: valuable ? { gp: loot.gp } : {} },
      publication: publication('Points of Interest'),
      quantity: valuable ? 1 : loot.quantity,
      rules: [],
      size: 'med',
      traits: { rarity: 'common', value: [] },
      slug: null,
      _migration: MIGRATION,
      equipped: { carryType: 'worn' },
    },
    effects: [],
    _stats: { ...stats, compendiumSource: null },
  };
}

/** Treasure the recipe builds from PF2e items when the actor is hydrated. */
function recipeTreasure(loot: Gear | Stock | Scroll, slug: string, source: Json | undefined): Treasure {
  if ('stock' in loot) {
    if (!source) throw new Error(`${slug}: stock() needs a source stat block`);
    const { stock: name, ...edit } = loot;
    return { kind: 'stock', item: ref(source, name), ...edit };
  }
  if ('spell' in loot) {
    const spell = docs.get(SPELL(loot.spell));
    const ordinal = ['', '1st', '2nd', '3rd'][loot.rank] ?? `${loot.rank}th`;
    const base = [...docs.entries()].find(([uuid, d]) => uuid.includes('.equipment-srd.') && d.type === 'consumable' && d.name === `Scroll of ${ordinal}-rank Spell`);
    if (!spell || !base) throw new Error(`${slug}: no scroll of spells-srd ${loot.spell} at rank ${loot.rank}`);
    const id = ids.item(slug, `Scroll of ${spell.name} (Rank ${loot.rank})`);
    return { kind: 'scroll', spell: SPELL(loot.spell), base: base[0], rank: loot.rank, id, spellId: stableId(`spell:${id}`) };
  }
  const { from, ...edit } = loot;
  const item = docs.get(EQUIPMENT(from));
  if (!item) throw new Error(`${slug}: no equipment-srd item ${from}`);
  return { kind: 'gear', uuid: EQUIPMENT(from), id: ids.item(slug, edit.name ?? item.name), ...edit };
}

function recipeHash(recipe: Omit<Recipe, 'hash' | 'verified'>): string {
  return createHash('sha256').update(JSON.stringify(recipe)).digest('hex').slice(0, 16);
}

function asset(path: string): string {
  if (!existsSync(join(ROOT, 'assets', path))) throw new Error(`missing art: assets/${path}`);
  return `modules/${MODULE_ID}/assets/${path}`;
}

function build(spec: Spec, encounter: number, sort: number): Json {
  const _id = ids.actor(spec.slug);
  const source = spec.source ? docs.get(spec.source) : undefined;
  if (spec.source && !source) throw new Error(`${spec.slug}: no PF2e actor ${spec.source}`);
  const appearance = spec.brief ? portraits.get(`${encounter}/${spec.brief}`) : undefined;
  if (spec.brief && !appearance) throw new Error(`${spec.slug}: no portrait brief "${spec.brief}" under encounter ${encounter}`);
  const appearanceHtml = appearance ? `<h2>Appearance</h2>\n<p>${html(appearance)}</p>` : '';
  const gmNote = `<p><strong>${encounterLink(encounter)}.</strong> ${html(spec.role)}</p>`;

  let actor: Json;
  if (source) {
    // The stub carries the stat block's level, size and rarity, which tokens and lists need before hydration.
    actor = {
      type: source.type,
      system: {
        details: { level: { value: source.system.details.level.value }, publicNotes: appearanceHtml, privateNotes: gmNote },
        traits: { size: { value: source.system.traits.size.value }, rarity: source.system.traits.rarity },
        _migration: MIGRATION,
      },
      items: [],
    };
  } else {
    const make = spec.custom ?? (spec.kind === 'remains' || spec.kind === 'cache' ? lootActor : undefined);
    if (!make) throw new Error(`${spec.slug}: needs a source or a custom builder`);
    actor = make(_id);
    const details = actor.system.details;
    if (actor.type === 'npc') {
      details.publicNotes = [details.publicNotes, appearanceHtml].filter(Boolean).join('\n');
      details.privateNotes = [gmNote, details.privateNotes].filter(Boolean).join('\n');
    } else {
      // Loot and hazards have one description field; a secret section keeps the GM note from observers.
      const secret = `<section class="secret" id="secret-${stableId(`secret:${spec.slug}`)}">\n${gmNote}\n</section>`;
      details.description = [details.description, appearanceHtml, secret].filter(Boolean).join('\n');
    }
  }

  const loot = TREASURE[spec.slug] ?? [];
  const own = loot.filter((entry): entry is Valuable | Keepsake => 'img' in entry);
  const lores = Object.entries(spec.lores ?? {}).map(([name, mod]) => loreItem(_id, name, mod));
  actor.items = [...actor.items, ...lores, ...own.map((entry) => ownItem(entry, _id, spec.slug))];

  const ops: Op[] = [
    // A voice speaks without a body: its gear and strikes stay with the troll or the corpse.
    ...(spec.kind === 'voice' ? [{ op: 'removeItems', types: BODYLESS } satisfies Op] : []),
    ...(spec.patch && source ? spec.patch(source) : []),
  ];
  const treasure = loot.filter((entry): entry is Gear | Stock | Scroll => !('img' in entry)).map((entry) => recipeTreasure(entry, spec.slug, source));
  const body = { ...(spec.source && { source: spec.source }), ...(spec.adjustment && { adjustment: spec.adjustment }), ops, treasure };
  const recipe: Recipe | undefined = spec.source || treasure.length ? { ...body, hash: recipeHash(body) } : undefined;

  const size = (source ?? actor).system.traits?.size?.value ?? 'med';
  const squares = TOKEN_SQUARES[size] ?? 1;
  const hostile = spec.kind === 'creature' || spec.kind === 'hazard';
  const portrait = spec.icon ?? asset(spec.portrait ?? `portraits/${spec.slug}.webp`);
  const tokenImg = spec.icon ?? asset(spec.token ?? `tokens/${spec.slug}.webp`);
  const stub: Json = {
    _id,
    _key: `!actors!${_id}`,
    name: spec.name,
    type: actor.type,
    img: portrait,
    system: actor.system,
    items: actor.items,
    effects: [],
    prototypeToken: {
      name: spec.tokenName ?? spec.name,
      actorLink: spec.linked ?? false,
      disposition: hostile ? -1 : 0,
      width: squares,
      height: squares,
      texture: { src: tokenImg, scaleX: 1, scaleY: 1 },
      ring: { enabled: false },
      flags: { pf2e: { linkToActorSize: true, autoscale: true } },
    },
    folder: ids.folder('actors', encounter),
    sort,
    // Limited lets players take from a loot actor's token once the GM reveals it.
    ownership: { default: actor.type === 'loot' ? LIMITED : 0 },
    flags: {
      ...(actor.type === 'npc' && loot.length ? { pf2e: { lootable: true } } : {}),
      [MODULE_ID]: {
        encounter,
        slug: spec.slug,
        kind: spec.kind,
        ...(spec.usesGear && { usesGear: true }),
        ...(spec.stowed && { stowed: true }),
        ...(recipe && { recipe }),
      },
    },
    _stats: { ...stats, compendiumSource: null },
  };

  if (recipe) {
    const { error, warnings } = hydrate(stub, { systemVersion: version, resolve: (uuid) => lookup(docs, uuid) });
    if (error || warnings.length) throw new Error([error, ...warnings].filter(Boolean).join('\n'));
    recipe.verified = version;
  }
  return stub;
}

function folder(encounter: number): Json {
  const _id = ids.folder('actors', encounter);
  return {
    _id,
    _key: `!folders!${_id}`,
    name: `${pad(encounter)}. ${titles.get(encounter)}`,
    type: 'Actor',
    folder: rootFolder('Actor')._id,
    sorting: 'm',
    sort: encounter * 1000,
    color: null,
    description: '',
    flags: {},
    _stats: { ...stats, compendiumSource: null },
  };
}

const system = findSystem();
if (!system) {
  console.error('No PF2e system found. Pass --system <path to Data/systems/pf2e>, or set PF2E_SYSTEM.');
  process.exit(1);
}
const version = systemVersion(system);
const docs = loadPacks(system, [...ACTOR_PACKS, 'equipment-srd', 'spells-srd']);
const reference = docs.get(ANKOU_ASSASSIN)!;
stats = {
  coreVersion: reference._stats.coreVersion,
  systemId: 'pf2e',
  systemVersion: reference._stats.systemVersion,
};
const capItem = docs.get(OZTHOOM_SHADOW_DOUBLE)?.items.find((i: Json) => i.name === 'Saving throws against Light effects');
if (!capItem) throw new Error('Ozthoom Shadow Double lost its light-save item; update shadowDouble()');
lightSaveCap = `${OZTHOOM_SHADOW_DOUBLE}.Item.${capItem._id}`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, '_folder-00-root.json'), `${JSON.stringify(rootFolder('Actor'), null, 2)}\n`);
let count = 0;
let recipes = 0;
const built = new Set<string>();
for (const encounter of [...titles.keys()].sort((a, b) => a - b)) {
  writeFileSync(join(OUT, `_folder-${pad(encounter)}.json`), `${JSON.stringify(folder(encounter), null, 2)}\n`);
  const specs = [...(ENCOUNTERS[encounter] ?? []), ...(HAZARDS[encounter] ?? []), ...(CACHES[encounter] ?? [])];
  specs.forEach((spec, i) => {
    const actor = build(spec, encounter, (i + 1) * 1000);
    writeFileSync(join(OUT, `${spec.slug}.json`), `${JSON.stringify(actor, null, 2)}\n`);
    built.add(spec.slug);
    count++;
    if (actor.flags[MODULE_ID].recipe) recipes++;
  });
}
const strays = Object.keys(TREASURE).filter((slug) => !built.has(slug));
if (strays.length) throw new Error(`treasure for unknown actors: ${strays.join(', ')}`);
console.log(`actors: ${count} actors in ${titles.size} folders → packs/_source/actors; ${recipes} recipes verified against PF2e ${version}`);

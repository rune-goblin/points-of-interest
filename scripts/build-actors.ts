// Generate the actors pack sources: one actor per character in docs/art/by-type/characters.md,
// plus the two custom hazards. Stat blocks are copied from the installed PF2e system's compendia
// (OGL/ORC content only; never from the paid pf2e-kingmaker module), renamed and re-arted.
// Not part of `npm run build`, because it needs a PF2e install; the output is committed.
//   node scripts/build-actors.ts [--system <path to Data/systems/pf2e>]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MODULE_ID, ids, pad, slugify, stableId } from './stable-id.ts';

const ROOT = process.cwd();
const OUT = join(ROOT, 'packs', '_source', 'actors');

type Json = Record<string, any>;
type Pack =
  | 'kingmaker-bestiary'
  | 'pathfinder-bestiary'
  | 'pathfinder-bestiary-2'
  | 'pathfinder-monster-core'
  | 'pathfinder-monster-core-2'
  | 'pathfinder-npc-core';
type Source = [Pack, string];

function systemDir(): string {
  const i = process.argv.indexOf('--system');
  const dir = i > 0 ? process.argv[i + 1] : join(ROOT, '_foundry-data', 'systems', 'pf2e');
  if (!dir || !existsSync(join(dir, 'packs'))) {
    console.error(`No PF2e system packs at ${dir ?? '(missing path)'}/packs.`);
    console.error('Pass --system <path to Data/systems/pf2e>, or run `npm run setup` to create _foundry-data.');
    process.exit(1);
  }
  return dir;
}

// Foundry holds a LOCK on packs it has open, so read copies instead of the live LevelDB.
function loadPacks(system: string, packs: Pack[]): Map<string, Json> {
  const tmp = mkdtempSync(join(tmpdir(), 'poi-actors-'));
  const fvtt = join(ROOT, 'node_modules', '.bin', 'fvtt');
  const docs = new Map<string, Json>();
  try {
    for (const pack of packs) {
      const ldb = join(tmp, 'ldb', pack);
      cpSync(join(system, 'packs', pack), ldb, { recursive: true });
      rmSync(join(ldb, 'LOCK'), { force: true });
      const json = join(tmp, 'json', pack);
      execFileSync(fvtt, ['package', 'unpack', pack, '--in', join(tmp, 'ldb'), '--out', json], { stdio: 'ignore' });
      for (const file of readdirSync(json)) {
        const doc = JSON.parse(readFileSync(join(json, file), 'utf8')) as Json;
        if (doc._key?.startsWith('!actors!')) docs.set(`${pack}/${doc._id}`, doc);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return docs;
}

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

type Kind = 'creature' | 'npc' | 'remains' | 'voice' | 'hazard';
interface Spec {
  slug: string;
  name: string;
  /** characters.md heading under the encounter; omitted for the haunt, which has no brief. */
  brief?: string;
  role: string;
  kind: Kind;
  source?: Source;
  adjustment?: 'elite' | 'weak';
  linked?: boolean;
  /** Shown on the canvas when it must differ from the actor name, e.g. so a double passes for the original. */
  tokenName?: string;
  /** Paths under assets/; default `portraits/<slug>.webp` and `tokens/<slug>.webp`. */
  portrait?: string;
  token?: string;
  custom?: (actorId: string) => Json;
  patch?: (actor: Json) => void;
}

const KM = (id: string): Source => ['kingmaker-bestiary', id];
const MC = (id: string): Source => ['pathfinder-monster-core', id];
const MC2 = (id: string): Source => ['pathfinder-monster-core-2', id];
const B1 = (id: string): Source => ['pathfinder-bestiary', id];
const B2 = (id: string): Source => ['pathfinder-bestiary-2', id];
const NPC = (id: string): Source => ['pathfinder-npc-core', id];

const ANKOU_ASSASSIN = KM('m8kwG6NskYDlBSCy');
const OZTHOOM = MC2('EG8jLZfIfTwA0b5g');
const OZTHOOM_SHADOW_DOUBLE = MC2('wNa8UPQqSepdxscG');
const CAUTHOOJ = MC('1a5faH5CCtFfbQHO');
const ATHACH = B2('CwrVQsRAeqlr1Vh0');
const HILL_GIANT_BUTCHER = KM('bF0FHdZMWl1OuRae');
const MINOGNOS_USHAD = KM('SjU0oB6pOk0XY8VN');
const RADIANT_WARDEN = KM('ASevlX00GdHGNWrS');
const WILD_HUNT_HOUND = KM('OnHIutiVLt1czwWL');
const WHIMWYRM = KM('SfFMqKTUQ1Dwu5lT');
const ILTHULIAK = KM('n82GZhM6joceE91v');

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

// The Ankou Assassin's Shadow Doubles: "the same statistics as an ankou, but they have the
// summoned trait, have 110 Hit Points, can't use Shadow Doubles or innate spells, and have an
// attack bonus of +27 for their Strikes", plus the light-save cap MC2's Ozthoom Shadow Double encodes.
let lightSaveCap: Json | undefined;
function shadowDouble(actor: Json): void {
  const hp = actor.system.attributes.hp;
  hp.max = hp.value = 110;
  actor.system.traits.value = [...new Set([...actor.system.traits.value, 'summoned'])].sort();
  const entries = new Set(actor.items.filter((i: Json) => i.type === 'spellcastingEntry').map((i: Json) => i._id));
  actor.items = actor.items.filter(
    (i: Json) =>
      i.type !== 'spellcastingEntry' &&
      !(i.type === 'spell' && entries.has(i.system.location?.value)) &&
      i.name !== 'Shadow Doubles',
  );
  for (const strike of actor.items.filter((i: Json) => i.type === 'melee')) strike.system.bonus.value = 27;
  if (lightSaveCap) actor.items.push(structuredClone(lightSaveCap));
}

function overrideStats(perception: number, will: number) {
  return (actor: Json): void => {
    actor.system.perception.mod = perception;
    actor.system.saves.will.value = will;
  };
}

const ENCOUNTERS: Record<number, Spec[]> = {
  1: [
    { slug: '01-ankou', name: 'The Ankou', brief: "The Ankou (Nyrissa's assassin)", kind: 'creature', source: ANKOU_ASSASSIN, linked: true,
      role: "Nyrissa's ankou. Drops from the rafters once the PCs find the shadow jar or three clues, opens with Shadow Doubles, and withdraws below 150 HP. If it escapes, it returns as the Speaker or the spared ankou in encounter 14." },
    { slug: '01-ankou-shadow-double-first', name: "The Ankou's Shadow Double (First)", brief: "The Ankou's Shadow Double (first)", kind: 'creature', source: ANKOU_ASSASSIN, patch: shadowDouble, tokenName: 'The Ankou',
      role: "A double from the ankou's Shadow Doubles (110 HP, Strikes +27, no innate spells). It vanishes when the ankou leaves or dies." },
    { slug: '01-ankou-shadow-double-second', name: "The Ankou's Shadow Double (Second)", brief: "The Ankou's Shadow Double (second)", kind: 'creature', source: ANKOU_ASSASSIN, patch: shadowDouble, tokenName: 'The Ankou',
      role: "The second double from Shadow Doubles (110 HP, Strikes +27, no innate spells)." },
    { slug: '01-felgo', name: 'Felgo', brief: 'Felgo (dead Pitaxian scout)', kind: 'remains', linked: true,
      role: 'The dead Pitaxian scout on the threshold, shadowless, two days dead with no wounds. DC 35 Medicine shows the heart simply stopped.' },
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
    { slug: '03-jotund-troll', name: 'The Jotund Troll', brief: 'The Jotund Troll', kind: 'creature', source: MC2('4Ay3tf49upoyaJrg'), linked: true,
      role: 'The nine-headed troll. It negotiates by head-vote and fights only if insulted twice, the vote fails, or the PCs attack; it flees into the moor at 120 HP.' },
    { slug: '03-envoy-troll-head', name: 'The Envoy (Troll Head)', brief: 'The Envoy (troll head)', kind: 'voice', linked: true,
      role: 'Speaking portrait for the head that mimics Ser Halward Toll. The Jotund Troll actor holds its statistics.' },
    { slug: '03-old-heads', name: 'The Old Heads (Troll Heads)', brief: 'The Old Heads (troll heads)', kind: 'voice', linked: true,
      role: 'Speaking portrait for the two Old Heads. The Jotund Troll actor holds their statistics.' },
    { slug: '03-ser-halward-toll', name: 'Ser Halward Toll', brief: 'Ser Halward Toll (dead envoy)', kind: 'remains', linked: true,
      role: "Irovetti's envoy, eaten mid-negotiation. His head sits on a stake beside the barrow; his satchel holds Irovetti's letter of offer, 400 gp and a greater bottled lightning." },
  ],
  4: [
    { slug: '04-matriarch-gorm', name: 'Matriarch Gorm', brief: 'Matriarch Gorm (athach, family head)', kind: 'creature', source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Head of the athach family. Holds the manor rubble and uses Throw Rock from cover.' },
    { slug: '04-rorrik', name: 'Rorrik', brief: "Rorrik (athach, Gorm's mate)", kind: 'creature', source: ATHACH, adjustment: 'elite', linked: true,
      role: "Gorm's mate. Holds the manor rubble beside her and hurls masonry." },
    { slug: '04-thud', name: 'Thud', brief: 'Thud (adolescent athach)', kind: 'creature', source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Adolescent athach working the maze in a pair, flanking for Athach Venom.' },
    { slug: '04-snip', name: 'Snip', brief: 'Snip (adolescent athach)', kind: 'creature', source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Adolescent athach working the maze in a pair.' },
    { slug: '04-mulch', name: 'Mulch', brief: 'Mulch (adolescent athach)', kind: 'creature', source: ATHACH, adjustment: 'elite', linked: true,
      role: 'Adolescent athach working the maze in a pair; starts by the compost pit.' },
    { slug: '04-bramble', name: 'Bramble', brief: 'Bramble (adolescent athach)', kind: 'creature', source: ATHACH, adjustment: 'elite', linked: true,
      role: 'The smallest, cruellest adolescent athach; first to grab a victim as a hostage.' },
    { slug: '04-captain-mira-vell', name: 'Captain Mira Vell', brief: 'Captain Mira Vell (living statue, Pitaxian officer)', kind: 'npc', source: CAPTAIN_OF_THE_GUARD, linked: true,
      role: 'Pitaxian officer and the most valuable victim: enfeebled 3 and unable to act until a DC 32 Medicine check or a cure. She can serve the PCs as an army commander or informant. NPC Core Captain of the Guard.' },
    { slug: '04-haddo', name: 'Haddo', brief: 'Haddo (living statue, farmer)', kind: 'npc', source: FARMER, linked: true,
      role: 'Victim on a plinth: enfeebled 3 and unable to act. NPC Core Farmer.' },
    { slug: '04-ysolde', name: 'Ysolde', brief: 'Ysolde (living statue, pedlar)', kind: 'npc', source: MERCHANT, linked: true,
      role: 'Victim on a plinth: enfeebled 3 and unable to act. NPC Core Merchant.' },
    { slug: '04-brother-amat', name: 'Brother Amat', brief: 'Brother Amat (living statue, wandering priest)', kind: 'npc', source: PROPHET, linked: true,
      role: 'Wandering priest of Erastil on a plinth: enfeebled 3 and unable to act. NPC Core Prophet.' },
    { slug: '04-tobin-herder-boy', name: 'Tobin', brief: 'Tobin (living statue, boy)', kind: 'npc', source: COMMONER, linked: true,
      role: 'A herder boy of about ten on a plinth: enfeebled 3 and unable to act. NPC Core Commoner.' },
  ],
  5: [
    { slug: '05-skulltaker', name: 'The Skulltaker', brief: 'The Skulltaker', kind: 'creature', source: MC('zkl6planCbeCuAdS'), linked: true,
      role: "Speaks through the antiquarians' skulls and trades Skeletal Lore answers for a new skull. In the fight it opens with Splintered Ground and keeps Shard Storm active." },
    { slug: '05-magister-corwen-ash', name: 'Magister Corwen Ash', brief: 'Magister Corwen Ash (dead antiquarian, voice in the wall)', kind: 'voice', linked: true,
      role: 'Speaking portrait for the dead antiquarian whose voice the skulltaker uses. The Skulltaker actor holds the statistics.' },
    { slug: '05-dalia-sorn', name: 'Dalia Sorn', brief: 'Dalia Sorn (dead antiquarian)', kind: 'voice', linked: true,
      role: 'Speaking portrait for a dead antiquarian in the wall. The Skulltaker actor holds the statistics.' },
    { slug: '05-hemmet-brask', name: 'Hemmet Brask', brief: 'Hemmet Brask (dead antiquarian)', kind: 'voice', linked: true,
      role: 'Speaking portrait for a dead antiquarian in the wall. The Skulltaker actor holds the statistics.' },
    { slug: '05-lio-venn', name: 'Lio Venn', brief: 'Lio Venn (dead antiquarian)', kind: 'voice', linked: true,
      role: 'Speaking portrait for a dead antiquarian in the wall. The Skulltaker actor holds the statistics.' },
    { slug: '05-skeletal-champion', name: 'Skeletal Champion', brief: 'Skeletal Champion (risen victim, optional)', kind: 'creature', source: MC('FH58AcRBZIfrHKvv'),
      role: "A creature that dies within 60 feet of the skulltaker rises as this skeletal champion in 1d4 rounds unless it succeeds at a DC 40 Will save (Bonetaker). Bonetaker names the Monster Core skeletal champion, a level 2 creature; it adds bodies to the fight, not threat. At party level 18 the four antiquarians rise on round 2." },
  ],
  6: [
    { slug: '06-grosh', name: 'Grosh', brief: 'Grosh (butcher leader)', kind: 'creature', source: HILL_GIANT_BUTCHER, linked: true,
      role: 'Leader of the four butchers. Opens with Menace Prey on the two richest-looking PCs.' },
    { slug: '06-murla', name: 'Murla', brief: 'Murla (rock-thrower)', kind: 'creature', source: HILL_GIANT_BUTCHER, linked: true,
      role: 'Climbs the shelf path and uses Throw Rock from the rock pile.' },
    { slug: '06-tuk', name: 'Tuk', brief: 'Tuk (twin hatchets)', kind: 'creature', source: HILL_GIANT_BUTCHER, linked: true,
      role: 'Closes and uses Twin Butchery on whoever leads.' },
    { slug: '06-hobb', name: 'Hobb', brief: 'Hobb (the coward)', kind: 'creature', source: HILL_GIANT_BUTCHER, linked: true,
      role: 'The first to flee up the shelf path toward Kob Moleg once two butchers fall.' },
    { slug: '06-ederis-pallo', name: 'Ederis Pallo', brief: 'Ederis Pallo (captive tax clerk)', kind: 'npc', source: TAX_COLLECTOR, linked: true,
      role: "Captive Pitaxian tax clerk carrying the delivery receipt sealed with Irovetti's signet; begs the PCs to destroy it. NPC Core Tax Collector." },
    { slug: '06-hesk-varro', name: 'Hesk Varro', brief: 'Hesk Varro (captive Numerian scavenger)', kind: 'npc', source: GUIDE, linked: true,
      role: 'Captive Numerian scavenger. Offers to guide the PCs to the Lightwardens (#8) or the Annihilator (#21) as payment. NPC Core Guide.' },
    { slug: '06-kael', name: 'Kael', brief: 'Kael (captive Tiger Lord outrider)', kind: 'npc', source: BANDIT, linked: true,
      role: 'Captive Tiger Lord outrider; owes the PCs a life-debt. The butchers kill him first. NPC Core Bandit.' },
  ],
  7: [
    { slug: '07-minognos-ushad', name: 'Minognos-Ushad', brief: 'Minognos-Ushad (legendary wyvern)', kind: 'creature', source: MINOGNOS_USHAD, linked: true,
      role: 'The wyvern queen. Part one: a flyover; she flees to BR3 at 100 HP or fewer. Part two: she returns 1d4 days later and fights to the death. Use the Diving actor for the swap mid-fight.' },
    { slug: '07-minognos-ushad-diving', name: 'Minognos-Ushad (Diving)', brief: 'Minognos-Ushad (diving)', kind: 'creature', source: MINOGNOS_USHAD, linked: true, tokenName: 'Minognos-Ushad',
      role: 'The same wyvern with diving art, for Powerful Dive out of the sun. Same statistics as Minognos-Ushad; swap the token rather than placing both.' },
  ],
  8: [
    { slug: '08-radiant-warden-dormant', name: 'Radiant Warden (Dormant)', brief: 'Radiant warden (dormant)', kind: 'creature', source: RADIANT_WARDEN, linked: true, tokenName: 'Orrery',
      role: 'The warden in its Orrery disguise. Swap to the Active actor when anyone enters the scorched ring or touches the hatch. It powers down if the hatch opens.' },
    { slug: '08-radiant-warden-active', name: 'Radiant Warden (Active)', brief: 'Radiant warden (active)', kind: 'creature', source: RADIANT_WARDEN, linked: true, tokenName: 'Radiant Warden',
      role: 'The warden awake: opens with Radiant Blast, then Radiant Blow to anchor PCs in the ring for the pylons. Same statistics as the Dormant actor.' },
  ],
  9: [
    { slug: '09-iron-juggernaut', name: 'The Iron Juggernaut', brief: 'The Iron Juggernaut', kind: 'creature', source: KM('qKCx4DrEL3vTcNC3'), adjustment: 'elite', linked: true,
      role: 'Elite Numerian adamantine golem reflavoured as a tracked hauler. Inexorable March on the trench, Vent as cutting lasers, fists against boarders; Repair Mode at 0 HP.' },
    { slug: '09-brann-kesk', name: 'Brann Kesk', brief: 'Brann Kesk (starving salvager)', kind: 'npc', source: MECHANIC, linked: true,
      role: "Starving salvager in the Juggernaut's hold, three days from death; he dies first. NPC Core Mechanic." },
    { slug: '09-ottilie-kesk', name: 'Ottilie Kesk', brief: 'Ottilie Kesk (starving salvager)', kind: 'npc', source: MECHANIC, linked: true,
      role: "Starving salvager in the hold; she can describe the Annihilator that caught them. NPC Core Mechanic." },
    { slug: '09-tarku', name: 'Tarku', brief: 'Tarku (remains)', kind: 'remains', linked: true,
      role: "A Kellid hunter delivered a century ago; the longest tally in the hold. His spear is a level 16 permanent item reflavoured as Kellid." },
  ],
  10: [
    { slug: '10-sileth', name: 'Sileth', brief: 'Sileth (Wild Hunt scout)', kind: 'creature', source: KM('fQ9FuovHuRt6vtcq'), linked: true,
      role: 'Wild Hunt scout hunting anyone carrying Pitaxian goods. Gives the PCs one round to run, then fires Befuddle beams and closes with the Crystal Scimitar. Calls a truce if half the hunt falls.' },
    { slug: '10-ash-tongue', name: 'Ash-Tongue', brief: 'Ash-Tongue (Wild Hunt hound)', kind: 'creature', source: WILD_HUNT_HOUND, linked: true,
      role: "Wild Hunt hound: Summon Pack on round one, then Knockdown to drop PCs for Sileth's sneak attacks." },
    { slug: '10-thornfoot', name: 'Thornfoot', brief: 'Thornfoot (Wild Hunt hound)', kind: 'creature', source: WILD_HUNT_HOUND, linked: true,
      role: 'Wild Hunt hound working with Ash-Tongue.' },
    { slug: '10-varga-tess', name: 'Varga Tess', brief: 'Varga Tess (dead agent)', kind: 'remains', linked: true,
      role: "Irovetti's agent who poached the white stag; her skeleton lies in the pod with her satchel (900 gp, a level 16 consumable, the stag's last antler tine)." },
  ],
  11: [
    { slug: '11-numerian-guthallath', name: 'Numerian Guthallath (the Colossus)', brief: 'Numerian guthallath (the Colossus)', kind: 'creature', source: KM('UqUj1IF3vCFuXYqb'), linked: true,
      role: 'The Colossus. Half-awake at Waking Clock 3–5 (two actions, feet stuck in the glass); awake at 6, it smashes the scaffold and opens with Annihilation Beams. Kingmaker Numerian Guthallah stat block.' },
    { slug: '11-master-engineer-odalric-vane', name: 'Master Engineer Odalric Vane', brief: 'Master Engineer Odalric Vane', kind: 'npc', source: GADGETEER, linked: true,
      role: 'The disgraced Starfall technician waking the Colossus, and the Influence target. The encounter treats him as level 8; this NPC Core Gadgeteer is level 6 and fits the role better than any level 8 stat block.' },
    { slug: '11-apprentice-hessa', name: 'Apprentice Hessa', brief: 'Apprentice Hessa', kind: 'npc', source: MECHANIC, linked: true,
      role: "One of Vane's apprentices tending the sigils on the scaffold; noncombatant. NPC Core Mechanic." },
    { slug: '11-apprentice-tobin', name: 'Apprentice Tobin', brief: 'Apprentice Tobin', kind: 'npc', source: MECHANIC, linked: true,
      role: "One of Vane's apprentices on the scaffold; noncombatant. NPC Core Mechanic." },
    { slug: '11-apprentice-marro', name: 'Apprentice Marro', brief: 'Apprentice Marro', kind: 'npc', source: MECHANIC, linked: true,
      role: "One of Vane's apprentices, tending the capacitor drums; noncombatant. NPC Core Mechanic." },
  ],
  12: [
    { slug: '12-sard', name: 'The Sard', brief: 'The sard', kind: 'creature', source: B2('eD1kydftMIp4CL2K'), linked: true,
      role: 'Threshold guardian of Thousand Voices. Warns in Sylvan through the thunder first; fights to the death with Thorn Volley, Trample and Splintering Death.' },
    { slug: '12-foreman-brannock', name: 'Foreman Brannock', brief: 'Foreman Brannock (remains)', kind: 'remains', linked: true,
      role: "Foreman of the logging crew the sard killed. His body lies beside the strongbox holding his ledger and 1,800 gp of wages." },
  ],
  13: [
    { slug: '13-primal-bandersnatch', name: 'Primal Bandersnatch', brief: 'Primal bandersnatch', kind: 'creature', source: KM('hLBHFloWuXLjCQYH'), linked: true,
      role: 'Stalks the PCs through the canyon on the Hunt Clock; at 6 it ambushes with Frumious Charge. Withdraws into the thickets below 100 HP to heal; fights to the death in its den.' },
    { slug: '13-wren-ashby', name: 'Wren Ashby', brief: 'Wren Ashby (remains)', kind: 'remains', linked: true,
      role: "Irovetti's ranger. Only a torn green cloak remains in the den; Wren's bow and pack lie nearby." },
  ],
  14: [
    { slug: '14-speaker', name: 'The Speaker', brief: 'The Speaker (ankou assassin)', kind: 'creature', source: ANKOU_ASSASSIN, linked: true,
      role: 'Ankou assassin who runs the audience through Telepathy and the Influence target. If it becomes a fight, it uses Shadow Doubles for three actions at once.' },
    { slug: '14-first-ankou', name: 'First Ankou', brief: 'First ankou', kind: 'creature', source: OZTHOOM,
      role: 'Court ankou. The remaster renamed the Bestiary 2 ankou the ozthoom; this is the Monster Core 2 Ozthoom (level 14). Flies in pairs, flanking for Sneak Attack.' },
    { slug: '14-second-ankou', name: 'Second Ankou', brief: 'Second ankou', kind: 'creature', source: OZTHOOM,
      role: 'Court ankou (Monster Core 2 Ozthoom, level 14, the remaster name for the ankou).' },
    { slug: '14-third-ankou', name: 'Third Ankou', brief: 'Third ankou', kind: 'creature', source: OZTHOOM,
      role: 'Court ankou (Monster Core 2 Ozthoom, level 14, the remaster name for the ankou).' },
    { slug: '14-fourth-ankou', name: 'Fourth Ankou', brief: 'Fourth ankou', kind: 'creature', source: OZTHOOM,
      role: 'Court ankou (Monster Core 2 Ozthoom, level 14, the remaster name for the ankou).' },
    { slug: '14-spared-ankou', name: 'Spared Ankou', brief: 'Spared ankou (optional, from the Shadowless Lodge)', kind: 'creature', source: ANKOU_ASSASSIN, linked: true,
      role: 'The ankou from the Shadowless Lodge (#1), present only if it escaped. It remembers the PCs by name. Showing a token taken from it lowers the Influence DCs by 2.' },
  ],
  15: [
    { slug: '15-pippet', name: 'Pippet', brief: 'Pippet (whimwyrm)', kind: 'creature', source: WHIMWYRM, linked: true,
      role: 'Dawn-coloured whimwyrm. Loves flattery and hates being ignored (+2 DC if a PC addresses Gloamsy first). Mood starts at 5.' },
    { slug: '15-gloamsy', name: 'Gloamsy', brief: 'Gloamsy (whimwyrm)', kind: 'creature', source: WHIMWYRM, linked: true,
      role: 'Dusk-coloured whimwyrm. Loves dark jokes and hates being touched; a Strike, touch spell or uninvited Interact sets her Mood to 0.' },
  ],
  16: [
    { slug: '16-vilderavn-herald', name: 'The Vilderavn Herald', brief: "The Vilderavn Herald (Lantern King's emissary)", kind: 'creature', source: KM('UXXEOnvp2MDaS9Sc'), linked: true,
      role: "The Lantern King's emissary, posing as Nyrissa's warden. Run as Influence over 4 rounds; in a fight it pulls its punches and withdraws with Forest Step below 100 HP." },
    { slug: '16-zomok', name: 'The Zomok', brief: "The Zomok (emissary's mount)", kind: 'creature', source: B2('Ge5Q5I7TTksf7QyN'), linked: true,
      role: "The herald's mount. Entombing Breath on clusters, Swallow Whole on the strongest melee PC." },
  ],
  17: [
    { slug: '17-mu-spore', name: 'The Mu Spore', brief: 'The Mu Spore', kind: 'creature', source: B1('VUJrPHKOjYkIQnWn'), linked: true,
      role: 'Omen of catastrophe anchored above the sinkhole. Opens with Enormous Inhalation; sonic damage stops its regeneration. While three or more corrupted trees stand, its Spores DC rises by 1 and it regains 10 more HP each round.' },
    { slug: '17-court-astrologer', name: 'The Court Astrologer', brief: 'The Court Astrologer (deceased)', kind: 'remains', linked: true,
      role: "Irovetti's astrologer, dead in the hunting blind. The notebook records that \"thunder made it shudder\" (DC 38 Society or Occultism); the satchel holds 2,500 gp and a major healing potion." },
  ],
  18: [
    { slug: '18-vashkra', name: 'Vashkra', brief: 'Vashkra (tor linnorm)', kind: 'creature', source: MC('0H54u83vZ1w3xHcD'), linked: true,
      role: 'Tor linnorm of the pass. Run as Influence over 5 rounds; a fight is for party level 18+. Whoever kills her saves against the Curse of Boiling Blood (DC 48 Will).' },
    { slug: '18-fallen-pitaxian-soldier', name: 'Fallen Pitaxian Soldier', brief: 'Pitaxian Soldier (fallen)', kind: 'remains',
      role: "One of fifty-two Pitaxian soldiers in the pass. Their regimental insignia and Irovetti's orders are evidence of Pitaxian aggression; their gear yields 800 gp." },
  ],
  19: [
    { slug: '19-ilthuliak-sighting', name: 'Ilthuliak (Sighting)', brief: 'Ilthuliak (black dragon)', kind: 'creature', source: ILTHULIAK, linked: true,
      tokenName: 'Ilthuliak', portrait: 'portraits/19-ilthuliak.webp', token: 'tokens/19-ilthuliak-sighting.webp',
      role: 'Before Chapter 10: she circles the spire twice and climbs into the clouds. No combat.' },
    { slug: '19-ilthuliak-ambush', name: 'Ilthuliak (Ambush)', brief: 'Ilthuliak (black dragon)', kind: 'creature', source: ILTHULIAK, linked: true,
      tokenName: 'Ilthuliak', portrait: 'portraits/19-ilthuliak.webp', token: 'tokens/19-ilthuliak-ambush.webp',
      role: 'After the PCs fight her in Chapter 10: she rises from the fen, opens with her Breath Weapon down the longest line, and flies to the roost below 100 HP.' },
  ],
  20: [
    { slug: '20-kaldurok', name: 'Kaldurok', brief: 'Kaldurok (lerritan)', kind: 'creature', source: B2('xfcFXLbadD3KdlHW'), linked: true,
      role: 'Lerritan burning toward Kettle Hollow in the name of Ymeri. Opens with Volcanic Eruption; fights to the death. Apply the elite adjustment at party level 19.' },
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
      role: "Aldo's mother, in the root cellar. NPC Core Commoner." },
    { slug: '21-pell-corl', name: 'Pell Corl', brief: 'Pell Corl (son)', kind: 'npc', source: COMMONER, linked: true,
      role: 'A boy of about eight, in the root cellar. NPC Core Commoner.' },
    { slug: '21-mira-corl', name: 'Mira Corl', brief: 'Mira Corl (daughter)', kind: 'npc', source: COMMONER, linked: true,
      role: 'A girl of about five, in the root cellar. NPC Core Commoner.' },
  ],
};

// Hazards come from the encounter stat blocks; the haunt borrows the skull-ring map note as art.
const HAZARDS: Record<number, Spec[]> = {
  5: [{ slug: '05-lament-of-the-wall', name: 'Lament of the Wall', kind: 'hazard', linked: true,
    custom: lament, portrait: 'map-notes/05-ossuary-wall.webp', token: 'map-notes/05-ossuary-wall.webp',
    role: 'Level 15 complex haunt that joins the skulltaker fight. Drop it for a Moderate threat (80 XP); at party level 18 raise it to level 17 (DCs +3).' }],
  8: [{ slug: '08-defence-pylon', name: 'Hull Defence Grid', brief: 'Defence pylon', kind: 'hazard', custom: defenceGrid,
    role: 'Complex hazard 16 (40 XP). Place one token per pylon (three); each unlinked token tracks its own pylon HP. Disabling all three opens the hatch, which powers down the warden.' }],
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
      '<p>The annihilator projects a shimmering field with 60 Hit Points. Damage reduces the field before the robot\'s HP. At the start of each of its turns, the field regains 15 HP. If the field drops to 0, it collapses and can\'t recover for [[/gmr 1d4 #rounds]]{1d4 rounds}; then it returns at 15 HP.</p><p>Each electricity hit that deals 15 or more damage also stuns the Force Field: it doesn\'t regain HP at the start of the annihilator\'s next turn.</p>'),
    action(id, k, 'Suppressed Response', 'reaction',
      '<p><strong>Trigger</strong> A creature within 120 feet critically hits the annihilator.</p><hr /><p><strong>Effect</strong> The annihilator makes a chain gun Strike against the triggering creature.</p>'),
    action(id, k, 'Booster Jets', 1,
      '<p>The annihilator gains a fly speed of 60 feet until the end of its next turn. It can\'t use Booster Jets again for 1 round.</p>',
      { category: 'interaction', traits: ['move'] }),
    action(id, k, 'Combined Arms', 2,
      '<p>The annihilator makes a claw Strike and a chain gun Strike, each at its current multiple attack penalty; the penalty increases after both.</p>'),
    action(id, k, 'Plasma Lance', 2,
      '<p>The tail projects a @Template[line|distance:120] of plasma. Each creature in the line takes @Damage[(9d6)[fire],(9d6)[electricity]] damage (@Check[reflex|dc:40|basic]). The annihilator can\'t use Plasma Lance again for [[/gmr 1d4 #rounds]]{1d4 rounds}.</p>',
      { traits: ['electricity', 'fire'] }),
    action(id, k, 'Suppressing Fire', 2,
      '<p>The chain guns sweep a @Template[cone|distance:60]. Each creature in the area takes @Damage[6d12[piercing]] damage (@Check[reflex|dc:38|basic]). A creature that fails is @UUID[Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg]{Off-Guard} until the end of its next turn.</p>'),
    action(id, k, 'Collect Specimen', 1,
      '<p>The annihilator picks up an unconscious or dying creature within its reach and seals them in a stasis bay. The creature stops making recovery checks and its dying value can\'t increase while inside. Opening a bay takes two Interact actions and a @Check[thievery|dc:38] check, or destroying the annihilator. A bay holds one creature; the annihilator has four bays.</p>',
      { category: 'interaction', traits: ['manipulate'] }),
    action(id, k, 'Deliver Cargo', 'passive',
      '<p>When two or more bays are full, or when the annihilator drops below 100 HP, it uses Booster Jets and leaves for the Juggernaut\'s docking cradle. It reaches the cradle in 8 hours and transfers every captive into the Juggernaut\'s hold, where stasis ends.</p>',
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
        blurb: 'Numerian war machine',
        languages: { value: ['common'], details: 'antique Numerian dialect' },
        level: { value: 18 },
        privateNotes: '',
        publicNotes: '<p>An annihilator robot ranges out of Numeria on orders older than any living nation: burn structures, destroy growth, and collect survivors. It carries captives in four stasis bays and brings them to the docking cradle on the Iron Juggernaut\'s loop, where it transfers them into the Juggernaut\'s hold.</p>',
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
        disable: '<p>@Check[religion|dc:36] to recite the funeral rites of the Kellid dead (three successes required), or @Check[diplomacy|dc:39] or Kellid Lore to promise the bones their chieftain will be honoured (two successes). Destroying the skulltaker also ends the haunt.</p>',
        isComplex: true,
        level: { value: 15 },
        publication: publication('Points of Interest'),
        reset: '<p>The haunt resets at the next dusk.</p>',
        routine: '<p>(1 action) The wall screams. Each living creature within the ring attempts a @Check[will|dc:36] save.</p><p><strong>Critical Success</strong> No effect.</p><p><strong>Success</strong> @UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened 1}.</p><p><strong>Failure</strong> @UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened 2}, and the creature can\'t reduce its frightened value below 1 while inside the ring.</p><p><strong>Critical Failure</strong> As failure, and the creature is @UUID[Compendium.pf2e.conditionitems.Item.sDPxOjQ9kx2RZE8D]{Fleeing} for 1 round.</p>',
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

// Statistics live on the parent creature; the voice actor only carries a portrait for chat.
function voice(): Json {
  const zero = { mod: 0 };
  return {
    type: 'npc',
    items: [],
    system: {
      abilities: { str: zero, dex: zero, con: zero, int: zero, wis: zero, cha: zero },
      attributes: {
        ac: { value: 10, details: '' },
        adjustment: null,
        allSaves: { value: '' },
        hp: { value: 1, max: 1, temp: 0, details: '' },
        speed: { value: 0, otherSpeeds: [], details: '' },
      },
      details: {
        blurb: 'Speaking portrait',
        languages: { value: [], details: '' },
        level: { value: 0 },
        privateNotes: '',
        publicNotes: '',
        publication: publication('Points of Interest'),
      },
      initiative: { statistic: 'perception' },
      perception: { details: '', mod: 0, senses: [] },
      resources: {},
      saves: { fortitude: { value: 0, saveDetail: '' }, reflex: { value: 0, saveDetail: '' }, will: { value: 0, saveDetail: '' } },
      skills: {},
      traits: { rarity: 'unique', size: { value: 'med' }, value: [] },
      _migration: MIGRATION,
    },
  };
}

function remains(): Json {
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

// Mirrors getHpAdjustment in the PF2e system's actor/creature/helpers.ts.
function hpAdjustment(level: number, adjustment: 'elite' | 'weak'): number {
  if (adjustment === 'elite') return level >= 20 ? 30 : level >= 5 ? 20 : level >= 2 ? 15 : 10;
  return level >= 21 ? -30 : level >= 6 ? -20 : level >= 3 ? -15 : level >= 1 ? -10 : 0;
}

const TOKEN_SQUARES: Record<string, number> = { tiny: 1, sm: 1, med: 1, lg: 2, huge: 3, grg: 4 };

function rekey(node: unknown, actorId: string): void {
  if (Array.isArray(node)) return node.forEach((n) => rekey(n, actorId));
  if (!node || typeof node !== 'object') return;
  const obj = node as Json;
  if (typeof obj._key === 'string' && obj._key.startsWith('!actors.')) {
    obj._key = obj._key.replace(/^(!actors\.[^!]+!)[^.]+/, `$1${actorId}`);
  }
  for (const value of Object.values(obj)) rekey(value, actorId);
}

const html = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function asset(path: string): string {
  if (!existsSync(join(ROOT, 'assets', path))) throw new Error(`missing art: assets/${path}`);
  return `modules/${MODULE_ID}/assets/${path}`;
}

function build(spec: Spec, encounter: number, sort: number, docs: Map<string, Json>): Json {
  const _id = ids.actor(spec.slug);
  let base: Json;
  if (spec.source) {
    const [pack, sourceId] = spec.source;
    const source = docs.get(`${pack}/${sourceId}`);
    if (!source) throw new Error(`${spec.slug}: no ${pack} actor ${sourceId}`);
    base = structuredClone(source);
    base._stats = { ...base._stats, compendiumSource: `Compendium.pf2e.${pack}.Actor.${sourceId}` };
  } else {
    const make = spec.custom ?? (spec.kind === 'voice' ? voice : spec.kind === 'remains' ? remains : undefined);
    if (!make) throw new Error(`${spec.slug}: needs a source or a custom builder`);
    base = { ...make(_id), _stats: { ...stats, compendiumSource: null } };
  }

  const actor: Json = { ...base, _id, _key: `!actors!${_id}`, name: spec.name };
  spec.patch?.(actor);
  rekey(actor.items, _id);
  rekey(actor.effects, _id);
  if (spec.adjustment) {
    actor.system.attributes.adjustment = spec.adjustment;
    // PF2e derives the adjusted max HP but stores current HP, as NPCPF2e#applyAdjustment does.
    actor.system.attributes.hp.value += hpAdjustment(actor.system.details.level.value, spec.adjustment);
  }

  const portrait = asset(spec.portrait ?? `portraits/${spec.slug}.webp`);
  const tokenImg = asset(spec.token ?? `tokens/${spec.slug}.webp`);
  const appearance = spec.brief ? portraits.get(`${encounter}/${spec.brief}`) : undefined;
  if (spec.brief && !appearance) throw new Error(`${spec.slug}: no portrait brief "${spec.brief}" under encounter ${encounter}`);
  const appearanceHtml = appearance ? `<h2>Appearance</h2>\n<p>${html(appearance)}</p>` : '';
  const gmNote = `<p><strong>${encounterLink(encounter)}.</strong> ${html(spec.role)}</p>`;

  const details = actor.system.details;
  if (actor.type === 'npc') {
    details.publicNotes = [details.publicNotes, appearanceHtml].filter(Boolean).join('\n');
    details.privateNotes = [gmNote, details.privateNotes].filter(Boolean).join('\n');
  } else {
    // Loot and hazards have one description field; a secret section keeps the GM note from observers.
    const secret = `<section class="secret" id="secret-${stableId(`secret:${spec.slug}`)}">\n${gmNote}\n</section>`;
    details.description = [details.description, appearanceHtml, secret].filter(Boolean).join('\n');
  }

  const size = actor.system.traits?.size?.value ?? 'med';
  const squares = TOKEN_SQUARES[size] ?? 1;
  const hostile = spec.kind === 'creature' || spec.kind === 'hazard';
  actor.img = portrait;
  actor.prototypeToken = {
    name: spec.tokenName ?? spec.name,
    actorLink: spec.linked ?? false,
    disposition: hostile ? -1 : 0,
    width: squares,
    height: squares,
    texture: { src: tokenImg, scaleX: 1, scaleY: 1 },
    ring: { enabled: false },
    flags: { pf2e: { linkToActorSize: true, autoscale: true } },
  };
  actor.folder = ids.folder('actors', encounter);
  actor.sort = sort;
  actor.ownership = { default: 0 };
  actor.flags = { [MODULE_ID]: { encounter } };
  actor.effects ??= [];
  return actor;
}

function folder(encounter: number): Json {
  const _id = ids.folder('actors', encounter);
  return {
    _id,
    _key: `!folders!${_id}`,
    name: `${pad(encounter)}. ${titles.get(encounter)}`,
    type: 'Actor',
    folder: null,
    sorting: 'm',
    sort: encounter * 1000,
    color: null,
    description: '',
    flags: {},
    _stats: { ...stats, compendiumSource: null },
  };
}

const docs = loadPacks(systemDir(), [
  'kingmaker-bestiary',
  'pathfinder-bestiary',
  'pathfinder-bestiary-2',
  'pathfinder-monster-core',
  'pathfinder-monster-core-2',
  'pathfinder-npc-core',
]);
const reference = docs.get(`${ANKOU_ASSASSIN[0]}/${ANKOU_ASSASSIN[1]}`)!;
stats = {
  coreVersion: reference._stats.coreVersion,
  systemId: 'pf2e',
  systemVersion: reference._stats.systemVersion,
};
lightSaveCap = docs.get(`${OZTHOOM_SHADOW_DOUBLE[0]}/${OZTHOOM_SHADOW_DOUBLE[1]}`)?.items.find(
  (i: Json) => i.name === 'Saving throws against Light effects',
);
if (!lightSaveCap) throw new Error('Ozthoom Shadow Double lost its light-save item; update shadowDouble()');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let count = 0;
for (const encounter of [...titles.keys()].sort((a, b) => a - b)) {
  writeFileSync(join(OUT, `_folder-${pad(encounter)}.json`), `${JSON.stringify(folder(encounter), null, 2)}\n`);
  const specs = [...(ENCOUNTERS[encounter] ?? []), ...(HAZARDS[encounter] ?? [])];
  specs.forEach((spec, i) => {
    const actor = build(spec, encounter, (i + 1) * 1000, docs);
    writeFileSync(join(OUT, `${spec.slug}.json`), `${JSON.stringify(actor, null, 2)}\n`);
    count++;
  });
}
console.log(`actors: ${count} actors in ${titles.size} folders → packs/_source/actors`);

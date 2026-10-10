// No Foundry globals here: the journal build and the specs import this module under Node.

import { checkSkill, linkChecks, namedSkills, shiftDC, withoutNote } from '../checks';

/** The entries a GM can reveal to players. */
export const GROUPS = ['discovery', 'skills', 'resistances', 'weaknesses'] as const;
export type InfluenceGroup = (typeof GROUPS)[number];
/** The entries a GM can post to chat: one check each. */
export type CheckGroup = Extract<InfluenceGroup, 'discovery' | 'skills'>;

export interface InfluenceThreshold {
  points: number;
  text: string;
}

export interface InfluenceData {
  name: string;
  aside: string;
  img: string;
  perception: string;
  will: string;
  discovery: string[];
  skills: string[];
  thresholds: InfluenceThreshold[];
  resistances: string[];
  weaknesses: string[];
  penalty: string;
  rounds: number | null;
}

export interface InfluenceItem {
  key: string;
  group: InfluenceGroup;
  /** An Influence skill's text carries its DC after the active modifiers. */
  text: string;
  shift: number;
}

/** A resistance's or weakness's DC change, and the Influence checks it covers: named skills, else a named target, else all. */
export interface InfluenceModifier {
  dc: number;
  skills: string[];
  target: string | null;
}

/** What players see: the GM's client writes it with each change, so unrevealed text never reaches them. */
export interface InfluenceView {
  name: string;
  img: string;
  thresholds: number[];
  rounds: number | null;
  items: { group: InfluenceGroup; text: string }[];
}

export interface InfluenceState {
  shown: boolean;
  points: number;
  round: number;
  revealed: string[];
  /** Keys of the resistances and weaknesses the GM switched on. */
  active: string[];
  view: InfluenceView | null;
}

export const initialState = (): InfluenceState => ({ shown: false, points: 0, round: 1, revealed: [], active: [], view: null });

const EFFECT = /([+\-–−])(\d+) DC on ([^;)]+)/;

/** Reads "(+2 DC on Intimidation)", "(–2 DC on the next check)" or "(–2 DC on checks to sway the Envoy)". */
export function modifierOf(text: string): InfluenceModifier | null {
  const match = text.match(EFFECT);
  if (!match) return null;
  const [, sign, amount, scope] = match;
  return {
    dc: (sign === '+' ? 1 : -1) * Number(amount),
    skills: namedSkills(scope),
    target: scope.match(/\bto sway (.+)$/)?.[1].trim() ?? null,
  };
}

const covers = (modifier: InfluenceModifier, entry: string): boolean => {
  if (modifier.skills.length) return modifier.skills.includes(checkSkill(entry));
  if (modifier.target) return entry.toLowerCase().includes(modifier.target.toLowerCase());
  return true;
};

/** The DC change the active resistances and weaknesses make to one Influence skill check. */
export function dcShift(data: InfluenceData, active: readonly string[], entry: string): number {
  return (['resistances', 'weaknesses'] as const)
    .flatMap((group) => data[group].map((text, i) => (active.includes(`${group}.${i}`) ? modifierOf(text) : null)))
    .reduce((sum, modifier) => sum + (modifier && covers(modifier, entry) ? modifier.dc : 0), 0);
}

export function influenceItems(data: InfluenceData, active: readonly string[] = []): InfluenceItem[] {
  return GROUPS.flatMap((group) =>
    data[group].map((entry, i) => {
      const shift = group === 'skills' ? dcShift(data, active, entry) : 0;
      return { key: `${group}.${i}`, group, text: shiftDC(entry, shift), shift };
    }),
  );
}

export function playerView(data: InfluenceData, revealed: readonly string[], active: readonly string[] = []): InfluenceView {
  return {
    name: data.name,
    img: data.img,
    thresholds: data.thresholds.map((t) => t.points),
    rounds: data.rounds,
    items: influenceItems(data, active)
      .filter((item) => revealed.includes(item.key))
      .map(({ group, text }) => ({ group, text })),
  };
}

// The traits of PF2e's own Discover and Influence actions; a secret Discover check rolls blind.
const TRAITS: Record<CheckGroup, string> = { discovery: 'concentrate,secret', skills: 'concentrate,linguistic' };

/** A check as players see it in chat: an inline check that shows its DC to everyone, without the GM's note. */
export const postedCheck = (entry: string, group: CheckGroup): string =>
  linkChecks(withoutNote(entry), ['showDC:all', `traits:${TRAITS[group]}`]);

export const meterLength = (thresholds: readonly number[], points: number): number => Math.max(points, ...thresholds, 1);

export const adjust = (value: number, by: number, min: number): number => Math.max(min, value + by);

export const toggled = (keys: readonly string[], key: string): string[] =>
  keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];

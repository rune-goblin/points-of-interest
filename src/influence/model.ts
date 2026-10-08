// No Foundry globals here: the journal build and the specs import this module under Node.

export const GROUPS = ['discovery', 'skills', 'resistances', 'weaknesses'] as const;
export type InfluenceGroup = (typeof GROUPS)[number];

export interface InfluenceThreshold {
  points: number;
  text: string;
}

export interface InfluenceData {
  name: string;
  aside: string;
  img: string;
  discovery: string;
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
  text: string;
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
  view: InfluenceView | null;
}

export const initialState = (): InfluenceState => ({ shown: false, points: 0, round: 1, revealed: [], view: null });

export function influenceItems(data: InfluenceData): InfluenceItem[] {
  const lists: Record<InfluenceGroup, string[]> = {
    discovery: [data.discovery],
    skills: data.skills,
    resistances: data.resistances,
    weaknesses: data.weaknesses,
  };
  return GROUPS.flatMap((group) => lists[group].map((text, i) => ({ key: `${group}.${i}`, group, text })));
}

export function playerView(data: InfluenceData, revealed: readonly string[]): InfluenceView {
  return {
    name: data.name,
    img: data.img,
    thresholds: data.thresholds.map((t) => t.points),
    rounds: data.rounds,
    items: influenceItems(data)
      .filter((item) => revealed.includes(item.key))
      .map(({ group, text }) => ({ group, text })),
  };
}

export const meterLength = (thresholds: readonly number[], points: number): number => Math.max(points, ...thresholds, 1);

export const adjust = (value: number, by: number, min: number): number => Math.max(min, value + by);

export const toggled = (keys: readonly string[], key: string): string[] =>
  keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];

import { describe, expect, it } from 'vitest';
import { adjust, dcShift, influenceItems, initialState, meterLength, modifierOf, playerView, postedCheck, toggled, type InfluenceData } from './model';

const data: InfluenceData = {
  name: 'Vashkra',
  aside: 'tor linnorm, level 21',
  img: 'modules/points-of-interest/assets/portraits/18-vashkra.webp',
  perception: '+37',
  will: '+33',
  discovery: ['DC 40 Nature', 'DC 40 Arcana', 'DC 42 Society'],
  skills: ['DC 42 Diplomacy', 'DC 40 Performance (she loves sagas of battle)'],
  thresholds: [
    { points: 2, text: 'She lets the PCs pass.' },
    { points: 6, text: 'She accepts a smaller tribute.' },
  ],
  resistances: ['Mentions of the King sour her (+2 DC on all checks that round).'],
  weaknesses: ['Tales of great battles delight her (–2 DC on Performance).'],
  penalty: 'Two critical failures provoke her.',
  rounds: 5,
};

describe('Influence tracker model', () => {
  it('starts hidden at Influence 0 in round 1 with nothing revealed', () => {
    expect(initialState()).toEqual({ shown: false, points: 0, round: 1, revealed: [], active: [], view: null });
  });

  it('keys every revealable entry by group and position, Discovery first', () => {
    expect(influenceItems(data).map((item) => item.key)).toEqual([
      'discovery.0', 'discovery.1', 'discovery.2', 'skills.0', 'skills.1', 'resistances.0', 'weaknesses.0',
    ]);
  });

  it('reads the DC change and the checks it covers from an effect', () => {
    expect(modifierOf('Threats provoke contempt (+2 DC on Intimidation; on a failure she turns away).')).toEqual({ dc: 2, skills: ['Intimidation'], target: null });
    expect(modifierOf('Flattery charms it (–2 DC on Diplomacy and Performance).')).toEqual({ dc: -2, skills: ['Diplomacy', 'Performance'], target: null });
    expect(modifierOf('Mentions of the King sour her (+2 DC on all checks that round).')).toEqual({ dc: 2, skills: [], target: null });
    expect(modifierOf('The Envoy loves honorific titles (–2 DC on checks to sway the Envoy).')).toEqual({ dc: -2, skills: [], target: 'the Envoy' });
    expect(modifierOf('Tending to Pell eases her fear (1 extra Influence point).')).toBeNull();
  });

  it('shifts the Influence skills an active resistance or weakness covers, and no Discovery check', () => {
    expect(dcShift(data, [], 'DC 42 Diplomacy')).toBe(0);
    expect(dcShift(data, ['resistances.0'], 'DC 42 Diplomacy')).toBe(2);
    expect(dcShift(data, ['weaknesses.0'], 'DC 42 Diplomacy')).toBe(0);
    expect(dcShift(data, ['resistances.0', 'weaknesses.0'], 'DC 40 Performance (she loves sagas of battle)')).toBe(0);
    const items = influenceItems(data, ['resistances.0']);
    expect(items.filter((item) => item.group === 'skills').map((item) => [item.text, item.shift])).toEqual([
      ['DC 44 Diplomacy', 2],
      ['DC 42 Performance (she loves sagas of battle)', 2],
    ]);
    expect(items.find((item) => item.key === 'discovery.0')).toMatchObject({ text: 'DC 40 Nature', shift: 0 });
  });

  it('applies a modifier that names a target only to the checks whose note names it', () => {
    const troll = { ...data, weaknesses: ['The Envoy loves honorific titles (–2 DC on checks to sway the Envoy).'] };
    expect(dcShift(troll, ['weaknesses.0'], 'DC 31 Society (the Envoy, court etiquette)')).toBe(-2);
    expect(dcShift(troll, ['weaknesses.0'], 'DC 34 Intimidation (the Grudges)')).toBe(0);
  });

  it('shows players only the entries the GM revealed, at the DCs in force, and never the threshold text, the penalty or the defences', () => {
    const view = playerView(data, ['discovery.1', 'skills.1', 'weaknesses.0'], ['weaknesses.0']);
    expect(view).toEqual({
      name: 'Vashkra',
      img: data.img,
      thresholds: [2, 6],
      rounds: 5,
      items: [
        { group: 'discovery', text: 'DC 40 Arcana' },
        { group: 'skills', text: 'DC 38 Performance (she loves sagas of battle)' },
        { group: 'weaknesses', text: 'Tales of great battles delight her (–2 DC on Performance).' },
      ],
    });
    expect(JSON.stringify(view)).not.toMatch(/tribute|provoke|\+37|\+33|sour/);
  });

  it('posts a check that shows players its DC and carries the action traits, without the GM note', () => {
    expect(postedCheck('DC 40 Performance (she loves sagas of battle)', 'skills')).toBe('@Check[performance|dc:40|showDC:all|traits:concentrate,linguistic]');
    expect(postedCheck('DC 30 Academia Lore', 'discovery')).toBe('@Check[academia-lore|dc:30|showDC:all|traits:concentrate,secret]');
    expect(postedCheck('DC 38 Lore about the river realms (news)', 'skills')).toBe('DC 38 Lore about the river realms');
  });

  it('runs the meter to the top threshold, or past it once the party gets there', () => {
    expect(meterLength([2, 4, 6], 3)).toBe(6);
    expect(meterLength([2, 4, 6], 8)).toBe(8);
  });

  it('keeps counts at their floor and toggles reveals', () => {
    expect(adjust(0, -1, 0)).toBe(0);
    expect(adjust(1, -1, 1)).toBe(1);
    expect(adjust(3, 1, 0)).toBe(4);
    expect(toggled(['skills.0'], 'skills.0')).toEqual([]);
    expect(toggled(['skills.0'], 'weaknesses.0')).toEqual(['skills.0', 'weaknesses.0']);
  });
});

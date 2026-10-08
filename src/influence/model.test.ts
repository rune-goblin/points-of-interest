import { describe, expect, it } from 'vitest';
import { adjust, influenceItems, initialState, meterLength, playerView, toggled, type InfluenceData } from './model';

const data: InfluenceData = {
  name: 'Vashkra',
  aside: 'tor linnorm, level 21',
  img: 'modules/points-of-interest/assets/portraits/18-vashkra.webp',
  discovery: 'DC 40 Nature or Arcana, DC 42 Society',
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
    expect(initialState()).toEqual({ shown: false, points: 0, round: 1, revealed: [], view: null });
  });

  it('keys every revealable entry by group and position, Discovery first', () => {
    expect(influenceItems(data).map((item) => item.key)).toEqual(['discovery.0', 'skills.0', 'skills.1', 'resistances.0', 'weaknesses.0']);
  });

  it('shows players only the entries the GM revealed, and never the threshold text or the penalty', () => {
    const view = playerView(data, ['skills.1', 'weaknesses.0']);
    expect(view).toEqual({
      name: 'Vashkra',
      img: data.img,
      thresholds: [2, 6],
      rounds: 5,
      items: [
        { group: 'skills', text: 'DC 40 Performance (she loves sagas of battle)' },
        { group: 'weaknesses', text: 'Tales of great battles delight her (–2 DC on Performance).' },
      ],
    });
    expect(JSON.stringify(view)).not.toMatch(/tribute|provoke/);
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

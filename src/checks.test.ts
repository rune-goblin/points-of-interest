import { describe, expect, it } from 'vitest';
import { singleChecks, withoutNote } from './checks';

describe('singleChecks', () => {
  it('gives each skill its own check and keeps the shared note on each', () => {
    expect(singleChecks('DC 39 Perception, Nature or Society')).toEqual(['DC 39 Perception', 'DC 39 Nature', 'DC 39 Society']);
    expect(singleChecks('DC 33 Deception or Diplomacy (the Grudges, with news of the King or a chance to strike him)')).toEqual([
      'DC 33 Deception (the Grudges, with news of the King or a chance to strike him)',
      'DC 33 Diplomacy (the Grudges, with news of the King or a chance to strike him)',
    ]);
    expect(singleChecks('DC 36 Fey Lore or Lore about the elder fey')).toEqual(['DC 36 Fey Lore', 'DC 36 Lore about the elder fey']);
  });

  it('keeps a lore whose own name holds an "or" whole', () => {
    expect(singleChecks('DC 38 Lore about the river realms or the northern kingdom (news of the world)')).toEqual([
      'DC 38 Lore about the river realms or the northern kingdom (news of the world)',
    ]);
  });

  it('drops the note from a check', () => {
    expect(withoutNote('DC 34 Medicine (showing her the hand)')).toBe('DC 34 Medicine');
    expect(withoutNote('DC 34 Diplomacy')).toBe('DC 34 Diplomacy');
  });
});

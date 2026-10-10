// No imports: the journal build loads this file under Node as well as in the bundle.

const SKILLS = 'Acrobatics|Arcana|Athletics|Crafting|Deception|Diplomacy|Intimidation|Medicine|Nature|Occultism|Performance|Religion|Society|Stealth|Survival|Thievery|Perception';
const STATISTIC = String.raw`(?:${SKILLS}|Fortitude|Reflex|Will|(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)* )+Lore)`;
const STATISTICS = String.raw`${STATISTIC}(?:(?:,? or |, )${STATISTIC})*`;
const DC_FIRST = new RegExp(String.raw`\bDC (\d+) (basic )?(${STATISTICS})`, 'g');
const DC_LAST = new RegExp(String.raw`\b(${STATISTICS}),? DC (\d+)\b`, 'g');
// Splits only before a statistic, so "Lore about the river realms or the northern kingdom" stays whole.
const ALTERNATIVE = new RegExp(String.raw`(?:,? or |, )(?=(?:${SKILLS}|Lore)\b|(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)* )+Lore\b)`);
const ENTRY = /^DC (\d+) (.+?)( \(.+\))?$/;

/** "DC 34 Perception or Society (note)" → "DC 34 Perception (note)" and "DC 34 Society (note)". */
export function singleChecks(entry: string): string[] {
  const match = entry.match(ENTRY);
  if (!match) return [entry];
  const [, dc, names, note = ''] = match;
  return names.split(ALTERNATIVE).map((name) => `DC ${dc} ${name}${note}`);
}

/** The skills and lores a phrase names: "Diplomacy and Performance" → ["Diplomacy", "Performance"]. */
export const namedSkills = (text: string): string[] =>
  text.match(new RegExp(String.raw`\b(?:${SKILLS}|(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)* )+Lore)\b`, 'g')) ?? [];

/** "DC 34 Medicine (showing her the hand)" → "Medicine". */
export const checkSkill = (entry: string): string => entry.match(ENTRY)?.[2] ?? '';

/** "DC 34 Medicine (note)" shifted by 2 → "DC 36 Medicine (note)". */
export const shiftDC = (entry: string, by: number): string => entry.replace(/^DC (\d+)/, (_, dc: string) => `DC ${Number(dc) + by}`);

/** "DC 34 Medicine (showing her the hand)" → "DC 34 Medicine". */
export const withoutNote = (entry: string): string => entry.replace(ENTRY, (_, dc: string, names: string) => `DC ${dc} ${names}`);

// Inside a markdown table row a bare pipe would split the cell.
function checkLinks(names: string, dc: string, basic: boolean, pipe: string, params: string[]): string {
  const extra = [...(basic ? ['basic'] : []), ...params].map((p) => `${pipe}${p}`).join('');
  return names
    .split(/(,? or |, )/)
    .map((part, i) => (i % 2 ? part : `@Check[${part.toLowerCase().replace(/ /g, '-')}${pipe}dc:${dc}${extra}]`))
    .join('');
}

/**
 * Turns "DC 36 Religion", "DC 35 basic Reflex" and "Society or Crafting, DC 36" into PF2e inline
 * checks, which a GM can roll or post to chat. Read-aloud lines stay as written. `params` adds
 * inline-check parameters such as `showDC:all` to every check.
 */
export function linkChecks(md: string, params: string[] = []): string {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('>')) return line;
      const pipe = line.startsWith('|') ? '\\|' : '|';
      return line
        .replace(DC_FIRST, (_, dc: string, basic: string | undefined, names: string) => checkLinks(names, dc, !!basic, pipe, params))
        .replace(DC_LAST, (_, names: string, dc: string) => checkLinks(names, dc, false, pipe, params));
    })
    .join('\n');
}

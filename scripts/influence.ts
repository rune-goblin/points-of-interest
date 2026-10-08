import type { InfluenceData, InfluenceThreshold } from '../src/influence/model.ts';

const HEAD = /^\*Influence: ([^*\n]+)\* \(([^)\n]+)\)$/;
const LINE = /^- \*\*([^*]+)\*\* (.+)$/;
const FIELDS = ['Perception', 'Discovery', 'Influence Skills', 'Resistances', 'Weaknesses', 'Penalty', 'Rounds'];

export type InfluenceBlock = Omit<InfluenceData, 'img'>;

const plain = (md: string): string => md.replace(/\*+/g, '').trim();
// Each resistance or weakness is one sentence, its effect in parentheses at the end.
const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map(plain);
// Skill entries each open with their DC; commas inside an entry's parentheses never precede one.
const entries = (text: string): string[] => text.split(/,\s+(?=DC \d)/).map(plain);

// A block that breaks the shared format throws, so the build stops before it ships.
export function influenceBlocks(md: string, where = 'encounter'): InfluenceBlock[] {
  const lines = md.split('\n');
  const blocks: InfluenceBlock[] = [];
  lines.forEach((line, i) => {
    const head = line.trim().match(HEAD);
    if (!head) return;
    const name = head[1].trim();
    const fields = new Map<string, string>();
    const thresholds: InfluenceThreshold[] = [];
    for (let j = i + 1; j < lines.length && lines[j].startsWith('- '); j++) {
      const item = lines[j].match(LINE);
      if (!item) throw new Error(`${where}: Influence block "${name}" has an unlabelled line: ${lines[j]}`);
      const [, label, text] = item;
      const threshold = label.match(/^Influence (\d+)$/);
      if (threshold) thresholds.push({ points: Number(threshold[1]), text: plain(text) });
      else fields.set(label, text);
    }
    const missing = FIELDS.filter((f) => !fields.has(f));
    if (missing.length) throw new Error(`${where}: Influence block "${name}" lacks ${missing.join(', ')}`);
    if (!thresholds.length) throw new Error(`${where}: Influence block "${name}" has no Influence thresholds`);
    if (thresholds.some((t, k) => k > 0 && t.points <= thresholds[k - 1].points)) {
      throw new Error(`${where}: Influence block "${name}" lists its thresholds out of order`);
    }
    const rounds = fields.get('Rounds')!.match(/^(\d+)\b/);
    blocks.push({
      name,
      aside: plain(head[2]),
      discovery: plain(fields.get('Discovery')!),
      skills: entries(fields.get('Influence Skills')!),
      thresholds,
      resistances: sentences(fields.get('Resistances')!),
      weaknesses: sentences(fields.get('Weaknesses')!),
      penalty: plain(fields.get('Penalty')!),
      rounds: rounds ? Number(rounds[1]) : null,
    });
  });
  return blocks;
}

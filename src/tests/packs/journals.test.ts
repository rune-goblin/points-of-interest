import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MODULE_ID = 'points-of-interest';
const SERVED = `modules/${MODULE_ID}/`;

interface Page { _id: string; name: string; type: string; src?: string; sort: number; text?: { content: string } }
interface Entry {
  _id: string;
  name: string;
  pages: Page[];
  flags: Record<string, { site?: number; hex?: string; icon?: string }>;
}

const dir = join(ROOT, 'packs', '_source', 'journals');
const entries = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Entry);
const sites = entries.filter((e) => e.flags[MODULE_ID]?.site !== undefined);
const headings = [...readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8').matchAll(/^### (\d+)\. /gm)];
const servedFile = (path: string): string => join(ROOT, path.slice(SERVED.length));

describe('journals pack sources', () => {
  it('has one entry per encounter heading plus the overview', () => {
    expect(sites.map((e) => e.flags[MODULE_ID].site).sort((a, b) => a! - b!)).toEqual(headings.map((h) => Number(h[1])));
    expect(entries).toHaveLength(sites.length + 1);
  });

  it('leads each site entry with its map-note handout, then the encounter', () => {
    for (const entry of sites) {
      const [handout, encounter] = [...entry.pages].sort((a, b) => a.sort - b.sort);
      expect(handout.type).toBe('image');
      expect(existsSync(servedFile(handout.src!))).toBe(true);
      expect(encounter.type).toBe('text');
    }
  });

  it('places each site on its own hex of the Kingmaker region map', () => {
    const hexes = sites.map((e) => e.flags[MODULE_ID].hex!);
    expect(new Set(hexes).size).toBe(hexes.length);
    for (const hex of hexes) {
      const [row, col] = hex.split('.').map(Number);
      expect(row).toBeLessThanOrEqual(10);
      expect(col).toBeLessThanOrEqual(29);
    }
  });

  it('gives each site a map icon that ships with the module', () => {
    for (const entry of sites) {
      const icon = entry.flags[MODULE_ID].icon!;
      expect(icon).toMatch(new RegExp(`^${SERVED}assets/map-icons/`));
      expect(existsSync(servedFile(icon))).toBe(true);
    }
  });

  it('resolves every link into the journals pack', () => {
    const uuids = new Set(
      entries.flatMap((e) => e.pages.map((p) => `Compendium.${MODULE_ID}.journals.JournalEntry.${e._id}.JournalEntryPage.${p._id}`)),
    );
    const links = entries.flatMap((e) =>
      e.pages.flatMap((p) => [...(p.text?.content ?? '').matchAll(/@UUID\[(Compendium\.points-of-interest\.journals\.[^\]]+)\]/g)].map((m) => m[1])),
    );
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((l) => !uuids.has(l))).toEqual([]);
  });
});

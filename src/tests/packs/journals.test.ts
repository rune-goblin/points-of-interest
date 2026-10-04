import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MODULE_ID = 'points-of-interest';
const SERVED = `modules/${MODULE_ID}/`;

interface Page {
  _id: string;
  name: string;
  type: string;
  src?: string;
  category: string;
  sort: number;
  title: { level: number };
  ownership: { default: number };
  text?: { content: string };
  flags: Record<string, { site?: number; hex?: string; icon?: string }>;
}
interface Journal {
  _id: string;
  ownership: { default: number };
  categories: { _id: string; _key: string; name: string; sort: number }[];
  pages: Page[];
}
interface PackDoc { _id: string; _key: string; flags?: Record<string, { encounter?: number }> }

const dir = join(ROOT, 'packs', '_source', 'journals');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const journal = JSON.parse(readFileSync(join(dir, files[0]), 'utf8')) as Journal;
const pages = [...journal.pages].sort((a, b) => a.sort - b.sort);
const sites = pages.filter((p) => p.flags[MODULE_ID]?.site !== undefined);
const headings = [...readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8').matchAll(/^### (\d+)\. /gm)];
const servedFile = (path: string): string => join(ROOT, path.slice(SERVED.length));

function packDocs(pack: string, collection: string): PackDoc[] {
  const path = join(ROOT, 'packs', '_source', pack);
  return readdirSync(path)
    .map((f) => JSON.parse(readFileSync(join(path, f), 'utf8')) as PackDoc)
    .filter((d) => d._key.startsWith(`!${collection}!`));
}
const scenes = packDocs('scenes', 'scenes');
const actors = packDocs('actors', 'actors');

describe('journals pack source', () => {
  it('holds the overview and every encounter in one journal', () => {
    expect(files).toHaveLength(1);
    expect(sites.map((p) => p.flags[MODULE_ID].site)).toEqual(headings.map((h) => Number(h[1])));
    expect(pages[0].name).toBe('Overview');
  });

  it('follows each encounter page with its map-note handout, one level down', () => {
    for (const site of sites) {
      const handout = pages[pages.indexOf(site) + 1];
      expect(site.type).toBe('text');
      expect(handout.type).toBe('image');
      expect(handout.category).toBe(site.category);
      expect(handout.title.level).toBe(site.title.level + 1);
      expect(existsSync(servedFile(handout.src!))).toBe(true);
    }
  });

  it('files every page under one of the journal categories, zones in document order', () => {
    const categories = new Set(journal.categories.map((c) => c._id));
    for (const page of pages) expect(categories.has(page.category), page.name).toBe(true);
    for (const c of journal.categories) expect(c._key).toBe(`!journal.categories!${journal._id}.${c._id}`);
    const order = [...new Set(sites.map((p) => p.category))];
    const sorted = [...journal.categories].sort((a, b) => a.sort - b.sort).map((c) => c._id);
    expect(sorted.filter((id) => order.includes(id))).toEqual(order);
  });

  it('lets players see site map notes but keeps every page closed to them', () => {
    expect(journal.ownership.default).toBe(1);
    for (const page of pages) expect(page.ownership.default).toBe(-1);
  });

  it('places each site on its own hex of the Kingmaker region map', () => {
    const hexes = sites.map((p) => p.flags[MODULE_ID].hex!);
    expect(new Set(hexes).size).toBe(hexes.length);
    for (const hex of hexes) {
      const [row, col] = hex.split('.').map(Number);
      expect(row).toBeLessThanOrEqual(10);
      expect(col).toBeLessThanOrEqual(29);
    }
  });

  it('gives each site a map icon that ships with the module', () => {
    for (const page of sites) {
      const icon = page.flags[MODULE_ID].icon!;
      expect(icon).toMatch(new RegExp(`^${SERVED}assets/map-icons/`));
      expect(existsSync(servedFile(icon))).toBe(true);
    }
  });

  it('heads each encounter page with its scenes and every actor of the encounter', () => {
    for (const site of sites) {
      const html = site.text!.content;
      const number = site.flags[MODULE_ID].site;
      const sceneIds = [...html.matchAll(/data-scene="([^"]+)"/g)].map((m) => m[1]);
      const actorIds = [...html.matchAll(/data-uuid="Compendium\.points-of-interest\.actors\.Actor\.([^"]+)"/g)].map((m) => m[1]);
      expect(sceneIds.sort(), site.name).toEqual(scenes.filter((s) => s.flags?.[MODULE_ID]?.encounter === number).map((s) => s._id).sort());
      expect(actorIds.sort(), site.name).toEqual(actors.filter((a) => a.flags?.[MODULE_ID]?.encounter === number).map((a) => a._id).sort());
      for (const [, src] of html.matchAll(/<img class="nopopout" src="([^"]+)"/g)) expect(existsSync(servedFile(src)), src).toBe(true);
    }
  });

  it('resolves every link into the journals pack', () => {
    const uuids = new Set(pages.map((p) => `Compendium.${MODULE_ID}.journals.JournalEntry.${journal._id}.JournalEntryPage.${p._id}`));
    const links = pages.flatMap((p) =>
      [...(p.text?.content ?? '').matchAll(/@UUID\[(Compendium\.points-of-interest\.journals\.[^\]]+)\]/g)].map((m) => m[1]),
    );
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((l) => !uuids.has(l))).toEqual([]);
  });
});

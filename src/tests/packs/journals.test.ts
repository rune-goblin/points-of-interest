import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { marked } from 'marked';

const ROOT = process.cwd();
// Loaded at runtime: tsconfig.json's rootDir is src/, so a static import of scripts/ fails `npm run check`.
const { linkChecks, encounterParts } = (await import(/* @vite-ignore */ join(ROOT, 'scripts', 'journal-html.ts'))) as {
  linkChecks(md: string): string;
  encounterParts(md: string, renderers: { block(md: string): string; inline(md: string): string }): { body: string };
};
const MODULE_ID = 'points-of-interest';
const SERVED = `modules/${MODULE_ID}/`;

interface Page {
  _id: string;
  name: string;
  type: string;
  src?: string;
  category?: string | null;
  sort: number;
  title: { show: boolean; level: number };
  ownership: { default: number };
  text?: { content: string };
  flags: Record<string, { site?: number; hex?: string; icon?: string }>;
}
interface Journal {
  _id: string;
  folder: string | null;
  ownership: { default: number };
  categories: { _id: string; _key: string; name: string; sort: number }[];
  pages: Page[];
}
interface PackDoc { _id: string; _key: string; flags?: Record<string, { encounter?: number }> }

const dir = join(ROOT, 'packs', '_source', 'journals');
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as { _key: string });
const journal = sources.find((d) => d._key.startsWith('!journal!')) as unknown as Journal;
const folders = sources.filter((d) => d._key.startsWith('!folders!')) as unknown as { _id: string; name: string; type: string; folder: string | null }[];
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
    expect(sources.filter((d) => d._key.startsWith('!journal!'))).toHaveLength(1);
    expect(sites.map((p) => p.flags[MODULE_ID].site)).toEqual(headings.map((h) => Number(h[1])));
    expect(pages[0].name).toBe('Overview');
  });

  it('files the journal in one Points of Interest folder', () => {
    expect(folders.map((f) => [f.name, f.type, f.folder])).toEqual([['Points of Interest', 'JournalEntry', null]]);
    expect(journal.folder).toBe(folders[0]._id);
  });

  it('heads the overview like a site page, with the Adventure banner and an illuminated initial', () => {
    const overview = pages[0];
    const html = overview.text!.content;
    expect(overview.title.show).toBe(false);
    expect(html).toMatch(/^<header class="poi-masthead"><h1 /);
    const banner = html.match(/<div class="poi-scene-art"><img class="nopopout" src="([^"]+)"/)?.[1];
    expect(banner).toBe(JSON.parse(readFileSync(join(ROOT, 'module.json'), 'utf8')).packs[0].banner);
    expect(existsSync(servedFile(banner!))).toBe(true);
    expect(html).toContain('<section class="poi-sec poi-sec--intro"><div class="poi-sec-body"><p><span class="poi-initial">');
  });

  it('leaves each site title to its masthead and its number to the sidebar', () => {
    for (const site of sites) {
      expect(site.title.show, site.name).toBe(false);
      expect(site.name).not.toMatch(/^\d/);
      expect(pages.indexOf(site), site.name).toBe(site.flags[MODULE_ID].site);
    }
  });

  it('keeps every site on one text page', () => {
    expect(pages.filter((p) => p.type !== 'text').map((p) => p.name)).toEqual([]);
    expect(pages).toHaveLength(sites.length + 1);
  });

  it('keeps the shareable King\'s note in the expandable encounter reference', () => {
    for (const site of sites) {
      const reference = site.text!.content.match(/<details class="poi-reference">([\s\S]+?)<\/details>/)?.[1];
      expect(reference, site.name).toContain('poi-facts');
      const note = reference?.match(/<figure class="poi-note"><img src="([^"]+)" title="The King's Note"/);
      expect(note, site.name).not.toBeNull();
      expect(note![1]).toMatch(new RegExp(`^${SERVED}assets/map-notes/white-ink/${String(site.flags[MODULE_ID].site).padStart(2, '0')}-`));
      expect(existsSync(servedFile(note![1]))).toBe(true);
    }
  });

  it("captions each King's note with its description", () => {
    for (const site of sites) expect(site.text!.content, site.name).toMatch(/<figure class="poi-note"><img [^>]+><figcaption>.+?<\/figcaption><\/figure>/);
  });

  it('opens each section and sub-section under a heading the contents sidebar leaves out', () => {
    const required = ['background', 'arrival', 'features', 'outcomes', 'rewards', 'scaling'];
    for (const page of pages) {
      const html = page.text!.content;
      const body = html.slice(html.indexOf('<div class="poi-body"'));
      expect(body.length, page.name).toBeGreaterThan(0);
      for (const [heading] of body.matchAll(/<h[1-6][^>]*>/g)) expect(heading, page.name).toContain('data-no-toc');
      expect(body.match(/<p><(strong|em)>[^<]+\.<\/\1>/g) ?? [], page.name).toEqual([]);
      if (page === pages[0]) continue;
      const kinds = new Set([...body.matchAll(/class="poi-sec poi-sec--([\w-]+)/g)].map((m) => m[1]));
      for (const kind of required) expect(kinds.has(kind), `${page.name}: ${kind}`).toBe(true);
    }
  });

  it('sets each Rewards line out as rows, XP first', () => {
    for (const site of sites) {
      const rows = [...site.text!.content.matchAll(/<div><dt>(\w+)<\/dt><dd>/g)].map((m) => m[1]);
      expect(rows[0], site.name).toBe('XP');
      expect(rows.slice(1).every((r) => r === 'Treasure' || r === 'Kingdom'), site.name).toBe(true);
    }
  });

  it('illuminates every Background while preserving its complete text', () => {
    const backgrounds = [...readFileSync(join(ROOT, 'docs', 'encounters.md'), 'utf8').matchAll(/^\*\*Background\.\*\* (.+)$/gm)];
    expect(backgrounds).toHaveLength(sites.length);
    for (const [index, site] of sites.entries()) {
      const paragraph = site.text!.content.match(/poi-sec--background[\s\S]+?<p>([\s\S]*?)<\/p>/)?.[1];
      const expected = marked.parseInline(linkChecks(backgrounds[index][1]), { async: false }) as string;
      expect(paragraph?.replace(/<[^>]*>/g, ''), site.name).toBe(expected.replace(/<[^>]*>/g, ''));
      const image = paragraph?.match(/<img class="nopopout" src="([^"]+)" alt="" aria-hidden="true"/);
      expect(image, site.name).not.toBeNull();
      expect(image![1]).toContain(`/initials/${backgrounds[index][1][0].toLowerCase()}.webp`);
      expect(existsSync(servedFile(image![1])), site.name).toBe(true);
    }
  });

  it('links every check and save that names a DC, outside read-aloud text', () => {
    const statistic = /\bDC \d+ (basic )?(Acrobatics|Arcana|Athletics|Crafting|Deception|Diplomacy|Intimidation|Medicine|Nature|Occultism|Performance|Religion|Society|Stealth|Survival|Thievery|Perception|Fortitude|Reflex|Will)\b/;
    for (const site of sites) {
      const html = site.text!.content.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, '');
      expect(html.match(statistic)?.[0], site.name).toBeUndefined();
      for (const [, check] of html.matchAll(/@Check\[([^\]]*)\]/g)) expect(check, site.name).toMatch(/^[a-z-]+\|dc:\d+(\|basic)?$/);
    }
  });

  it('lists the pages without categories', () => {
    expect(journal.categories).toEqual([]);
    for (const page of pages) expect(page.category ?? null, page.name).toBeNull();
  });

  it('keeps the journal, its pages and its pins closed to players', () => {
    expect(journal.ownership.default).toBe(0);
    for (const page of pages) expect(page.ownership.default).toBe(-1);
  });

  it('places each site on its own hex of the region map', () => {
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
      const maps = [...html.matchAll(/data-map="([^"]+)"/g)].map((m) => m[1]);
      expect(maps.length, site.name).toBe(sceneIds.length);
      for (const map of maps) expect(existsSync(servedFile(map)), map).toBe(true);
      for (const [, src] of html.matchAll(/<img class="nopopout" src="([^"]+)"/g)) {
        // Treasure caches show core Foundry icons, which ship with Foundry rather than the module.
        if (!src.startsWith('icons/')) expect(existsSync(servedFile(src)), src).toBe(true);
      }
    }
  });

  it('ships three distinct manuscript illustrations for every encounter', () => {
    const all = new Set<string>();
    for (const site of sites) {
      const html = site.text!.content;
      const images = [...html.matchAll(/<img class="(poi-(?:margin|location)-study[^\"]*)" src="([^\"]+)"([^>]+)>/g)];
      expect(images, site.name).toHaveLength(3);
      const prefix = `${SERVED}assets/journal/encounters/${String(site.flags[MODULE_ID].site).padStart(2, '0')}-`;
      for (const [, classes, src, attributes] of images) {
        expect(src.startsWith(prefix), site.name).toBe(true);
        expect(existsSync(servedFile(src)), src).toBe(true);
        expect(attributes).toContain('aria-hidden="true"');
        expect(classes).toContain('nopopout');
        expect(all.has(src), `${site.name}: duplicated illustration`).toBe(false);
        all.add(src);
      }
    }
    expect(all.size).toBe(63);
  });

  it('pairs every banner with its own establishing art, player share, tactical map, and scene action', () => {
    for (const site of sites) {
      const html = site.text!.content;
      expect(html.indexOf('poi-site'), site.name).toBeLessThan(html.indexOf('poi-reference'));
      const banners = [...html.matchAll(/<figure class="poi-scene-card">([\s\S]+?)<\/figure>/g)];
      const siteScenes = scenes.filter((s) => s.flags?.[MODULE_ID]?.encounter === site.flags[MODULE_ID].site);
      expect(banners.length, site.name).toBe(siteScenes.length);
      for (const [, banner] of banners) {
        const art = banner.match(/data-image="([^"]+)"/)?.[1];
        const map = banner.match(/data-map="([^"]+)"/)?.[1];
        expect(art, site.name).toBe(map?.replace('/assets/maps/', '/assets/establishing/'));
        expect(existsSync(servedFile(art!)), art).toBe(true);
        expect(banner).toContain(`<div class="poi-scene-art"><img class="nopopout" src="${art}"`);
        expect(banner).not.toContain('href=');
        expect(banner).toContain(`class="poi-show-players" data-image="${art}"`);
        expect(banner).toContain('class="poi-show-map"');
        expect(banner).toContain('class="poi-open-scene"');
        const sceneId = banner.match(/data-scene="([^"]+)"/)?.[1];
        const scene = siteScenes.find((s) => s._id === sceneId) as PackDoc & { levels: { background: { src: string } }[] };
        expect(map).toBe(scene.levels[0].background.src);
      }
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

describe('linkChecks', () => {
  it('links each statistic in a list, keeping its separators', () => {
    expect(linkChecks('a DC 39 Perception, Nature or Society check')).toBe(
      'a @Check[perception|dc:39], @Check[nature|dc:39] or @Check[society|dc:39] check',
    );
  });

  it('marks basic saves and links Lore skills', () => {
    expect(linkChecks('(DC 35 basic Reflex)')).toBe('(@Check[reflex|dc:35|basic])');
    expect(linkChecks('DC 39 Diplomacy or Hill-Clan Lore')).toBe('@Check[diplomacy|dc:39] or @Check[hill-clan-lore|dc:39]');
  });

  it('reads a DC that follows its statistics', () => {
    expect(linkChecks('(Society or Crafting, DC 36)')).toBe('(@Check[society|dc:36] or @Check[crafting|dc:36])');
  });

  it('escapes pipes in table rows and leaves read-aloud lines alone', () => {
    expect(linkChecks('| Den | DC 36 Perception |')).toBe('| Den | @Check[perception\\|dc:36] |');
    expect(linkChecks('> a DC 30 Athletics climb')).toBe('> a DC 30 Athletics climb');
  });

  it('leaves a DC with no statistic, or a creature\'s own DC, as written', () => {
    expect(linkChecks('until it Escapes (DC 30)')).toBe('until it Escapes (DC 30)');
    expect(linkChecks('- **Perception** DC 42')).toBe('- **Perception** DC 42');
  });
});

describe('numbered outcomes', () => {
  const renderers = {
    block: (md: string) => marked.parse(md, { async: false }) as string,
    inline: (md: string) => marked.parseInline(md, { async: false }) as string,
  };

  it('preserves emphasis, checks, and links in outcome descriptions', () => {
    const { body } = encounterParts('**Outcomes.**\n- **Released.** A DC 36 Religion check grants *peace*. See [the court](#court).\n- **Escaped.** The ankou reports to the queen.', renderers);
    expect(body).toContain('<ol class="poi-outcomes">');
    expect(body).toContain('<strong class="poi-term">Released.</strong>');
    expect(body).toContain('@Check[religion|dc:36]');
    expect(body).toContain('<em>peace</em>');
    expect(body).toContain('<a href="#court">the court</a>');
    expect(body).toContain('<strong class="poi-term">Escaped.</strong> The ankou reports to the queen.</p>');
  });

  it('numbers outcomes when labels are absent', () => {
    const { body } = encounterParts('**Outcomes.**\n- The scouts rest.\n- The court waits.', renderers);
    expect(body).toContain('<ol class="poi-outcomes">');
    expect(body).toContain('<li><p>The scouts rest.</p>');
    expect(body).toContain('<li><p>The court waits.</p>');
  });
});

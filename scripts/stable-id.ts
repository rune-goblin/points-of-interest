// Shared by every pack generator so cross-pack @UUID links agree on ids without a lookup table.
import { createHash } from 'node:crypto';

export const MODULE_ID = 'points-of-interest';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function stableId(key: string): string {
  const hash = createHash('sha256').update(`${MODULE_ID}:${key}`).digest();
  return Array.from(hash.subarray(0, 16), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// GitHub's heading-anchor rule, which the markdown links were written against.
export function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');
}

export const pad = (n: number): string => String(n).padStart(2, '0');

export const ids = {
  overviewJournal: () => stableId('journal:overview'),
  /** One journal entry per site; `headingSlug` is the encounter heading's slug, e.g. `1-the-shadowless-lodge`. */
  siteJournal: (headingSlug: string) => stableId(`journal:${headingSlug}`),
  encounterPage: (headingSlug: string) => stableId(`page:${headingSlug}`),
  handoutPage: (headingSlug: string) => stableId(`note:${headingSlug}`),
  /** `artSlug` is the shared portrait/token file name without extension, e.g. `01-ankou`. */
  actor: (artSlug: string) => stableId(`actor:${artSlug}`),
  /** `mapSlug` is the map file name without extension, e.g. `09-iron-juggernaut-cargo-hold`. */
  scene: (mapSlug: string) => stableId(`scene:${mapSlug}`),
  folder: (pack: string, encounter: number) => stableId(`folder:${pack}:${pad(encounter)}`),
};

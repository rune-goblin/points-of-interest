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

export type FolderType = 'Actor' | 'Scene' | 'JournalEntry' | 'Macro';

/** The one top-level folder that holds everything of a document type the Adventure imports. */
export function rootFolder(type: FolderType) {
  const _id = stableId(`folder:root:${type}`);
  return { _id, _key: `!folders!${_id}`, name: 'Points of Interest', type, folder: null, description: '', sorting: 'm', sort: 0, color: '#3b2a1a', flags: {} };
}

export const ids = {
  // Pinned to the id the journal's first release hashed from its old title, so world copies keep matching.
  /** The one journal entry that holds the overview and every site. */
  journal: () => 'jxn9bB1XhZTRpF65',
  /** `headingSlug` is the encounter heading's slug, e.g. `1-the-shadowless-lodge`. */
  encounterPage: (headingSlug: string) => stableId(`page:${headingSlug}`),
  /** `artSlug` is the shared portrait/token file name without extension, e.g. `01-ankou`. */
  actor: (artSlug: string) => stableId(`actor:${artSlug}`),
  /** An item an actor carries, keyed by the actor's slug and the item's name. */
  item: (actorSlug: string, name: string) => stableId(`item:${actorSlug}:${slugify(name)}`),
  /** `mapSlug` is the map file name without extension, e.g. `09-iron-juggernaut-cargo-hold`. */
  scene: (mapSlug: string) => stableId(`scene:${mapSlug}`),
  folder: (pack: string, encounter: number) => stableId(`folder:${pack}:${pad(encounter)}`),
  /** `slug` is the macro's source file name without extension, e.g. `place-map-notes`. */
  macro: (slug: string) => stableId(`macro:${slug}`),
};

# points-of-interest — project rules

A Foundry VTT **Pathfinder 2e** content module for a kingdom campaign at party level 16 and up: the points of
interest the King marked on his map of the western borderlands. Each site gets a journal page,
a scene, actors and art. Built from the Rune Goblin module template (TypeScript + Vite esmodule,
compendium packs from `packs/_source/`).

## Content layout

- `docs/encounters.md` — **canonical encounter text.** `npm run build` regenerates the journal
  pack sources from it (`scripts/build-journal.ts`); never hand-edit `packs/_source/journals/`.
  Page ids hash from the heading slug, so renaming an encounter heading changes its page id.
  One journal, "Points of Interest", holds the overview, then one text page per site in encounter order
  (no categories). Each encounter page opens with the King's note (the white-ink redraw, captioned with
  the "**The King's map note.**" paragraph); a GM clicks it and presses Show Players in the popout to share it.
  `scripts/journal-html.ts` structures the rest, so keep the markdown patterns it reads: a run-in label
  (`**Background.** …`) opens a section under a large heading, and an italic one (`*The heads.* …`) a
  sub-section; `**NAME** — HAZARD 15` (or `CREATURE`) starts a stat block that runs while paragraphs open
  with a bold term; `**Name** (aside)` or `*Influence: Name* (aside)` followed by a list makes an Influence
  card; the Rewards line splits into XP, Treasure and Kingdom rows at sentences opening "Treasure" or
  "Kingdom". Write checks as "DC 36 Religion", "DC 35 basic Reflex" or "Society or Crafting, DC 36": the
  build makes each a PF2e `@Check` a GM can roll or post to chat (read-aloud text excepted). `src/styles.css`
  styles the pages for both themes with `light-dark()`: 16 px text, mixed-case headings, no all-caps labels.
- Each encounter's header table has a `| **Hex** | row.col |` row: the site's hex on the
  `pf2e-kingmaker` region map (the key its hex HUD shows). The build copies it into the
  site's encounter page `flags['points-of-interest'].hex`, and `src/map-notes.ts` places the map note from it.
- Everything the Adventure imports sits in one "Points of Interest" folder per sidebar tab (actors,
  scenes, journal, macros; `rootFolder()` in `scripts/stable-id.ts`). Actors sit in an encounter folder inside it; scenes sit
  in it directly. A piece imported on its own brings its folders along (`importFolders()`).
- Every generated id comes from `scripts/stable-id.ts` (`ids.journal`, `ids.actor`, `ids.scene`, …),
  so the packs link to each other without a lookup table. Scenes and actors carry
  `flags['points-of-interest'].encounter`; `build-journal.ts` reads it to head each encounter page
  with its scenes (a preview card per scene) and each scene's tokens, so `build-scenes.ts` runs before
  it in `npm run build`. Scene cards are `a.poi-scene[data-scene]`, which `src/scene-links.ts` views
  (importing the scene and its actors when the world lacks them); a core link would open the scene's
  linked journal, the same page. Tokens are core content links (`data-link`) to world actors once the
  Adventure build rewrites them; `src/actors/runtime.ts` imports a linked actor the world lacks before
  opening or dropping it. Previews live in `assets/maps/previews/` (800 px, made by cwebp
  on build only when missing, committed like the thumbnails).
- `scripts/build-scenes.ts` → `packs/_source/scenes/` (generated on build). One scene per map, native
  v14 (one level holds the background). Grid sizes are judged per map and recorded in its table.
  It seeds each scene's actors as tokens; placeables edited in Foundry and unpacked over
  `packs/_source/scenes/` survive regeneration (a scene reseeds only when it has no tokens). A scene
  that has tokens gains one for each cast member it lacks, in a row along the map's top edge, so a
  token deleted in Foundry comes back on the next build; drop an actor from a scene with `SCENE_CAST`.
  It reads each actor's slug and kind from `flags['points-of-interest']` and seeds caches hidden.
  Every scene also gets a book note (flagged `scene`) in the map's top-left square, linked to its
  encounter page; the build regenerates it each run and keeps only an unpacked move. The `refreshNote`
  hook hides it from players, who hold Limited on the journal and would otherwise see the pin.
- `scripts/build-actors.ts` → `packs/_source/actors/` (**committed, not part of `npm run build`**: it
  needs an installed PF2e system; `npm run build:actors -- --system <Data/systems/pf2e>`, or
  `$PF2E_SYSTEM`, or the default install path). The mapping table at its top names each actor's
  source stat block. Reference only PF2e **system** packs, never the premium `pf2e-kingmaker` module.
  The remaster renamed the ankou "Ozthoom" (Monster Core 2); the Kingmaker Ankou Assassin keeps its name.
  **Nothing copied from PF2e ships.** An actor built on a system stat block is a stub: our name, art,
  notes and items, the stat block's level, size and rarity, and a recipe in
  `flags['points-of-interest'].recipe` naming the PF2e documents by UUID and the changes to make
  (ops, treasure, adjustment). `src/actors/hydrate.ts` (pure, shared by the build, the specs and the
  module) turns a stub into the full actor; `src/actors/runtime.ts` runs it whenever a stub reaches a
  world (Adventure import via `preImportAdventure`, scene-card import, any `createActor`, a journal
  token click or canvas drop, and the active GM's world-load sweep) and, after a module update changes
  a recipe, asks the GM to rebuild the affected actors. The build hydrates every recipe against the
  installed system, fails on any warning, and stamps it `verified`. Generic system item names in
  recipes are fallbacks for drifted ids.
  Voices (kind `voice`: the troll heads and the dead antiquarians) are speaking portraits kept off the
  maps, but each carries a real stat block without gear or strikes: the heads share the Jotund
  Troll's defences and add their bloc's skills, and the antiquarians keep their NPC Core stat
  blocks from life. Rename NPC Core placeholder lores ("Lore (any one…)", "Narrow Lore") with
  `renameItem`; a spec rejects them.
  `TREASURE` (keyed by actor slug) turns each encounter's Rewards into items: PF2e `equipment-srd` copies
  (with runes, material, size), coins, custom valuables and story items, and a scroll built the way
  PF2e's `createConsumableFromSpell` builds one. Creatures and NPCs carry what they own and get
  `flags.pf2e.lootable`; remains hold what lies on the body; `CACHES` adds a loot actor (core Foundry
  icon) for treasure lying at a site. Loot actors ship with default Limited ownership, which PF2e
  needs to let players take from them, and `src/scene-links.ts` keeps it on import. Keep the item
  names in `docs/encounters.md` Rewards in step with the table.
  **Enemies carry and use what they could use; nothing usable lies in the open.** A creature spec
  marked `usesGear` (a body that can wield and wear) must carry and use everything at its site it
  could use: weapons (bombs too), shields, armour and worn items of its size, potions and elixirs if
  it lives, scrolls and wands of a tradition it casts. In use means a weapon linked by one of its
  strikes, armour worn, a shield held, a worn item worn and invested, a consumable carried. A cache
  marked `stowed` (a chest, strongbox, sealed chamber or hidden packet) is exempt. Hydration equips
  gear handed to such a creature; a weapon must be a `stock()` entry (the stat block's own weapon,
  renamed as treasure, `runes` optional) so its strike stays linked. PF2e resets an NPC strike's
  property runes each prepare and applies a linked weapon's runes only through `AdjustStrike`
  (`property-runes`) rules on the strike, so hydration adds one per rune, as the bestiaries do.
  `src/tests/packs/actors.hydrated.test.ts` enforces both rules on hydrated actors; it needs an
  installed PF2e and skips without one, so run it after every PF2e update. `actors.test.ts` (CI)
  checks that the stubs carry nothing from PF2e and that every recipe is hashed and verified.
- `docs/art/NN-slug.md` — art briefs per encounter; `docs/art/by-type/` — the same briefs
  regrouped as map notes, maps and characters.
- `docs/pitches.md` — the original one-paragraph pitches.
- `assets/maps|portraits|tokens/NN-name.webp` — art, prefixed with the encounter number.
  A character's portrait and token share a file name. Reference art by its served path
  `modules/points-of-interest/assets/…`.
- `assets/map-notes/white-ink/NN-name.webp` — the King's map-note sketches in white ink on transparency,
  the only map-note art. They head the encounter pages and feed the map icons and the banner.
- `assets/map-icons/NN-name.webp` — 512 px map-pin icons derived from `assets/map-notes/white-ink/`
  (a 25% black scrim filling the region hex, the sketch fitted inside it with coloured accents
  lightened, square). Regenerate with `npm run build:icons` (needs ImageMagick 7)
  after changing that art; the icons are committed, not built.
- `assets/adventure-banner.webp` — the Adventure's banner (module.json `banner`, shown by the importer
  and the compendium sidebar): #07's white-ink sketch, inked navy, on generated parchment. `npm run build:banner`
  redraws it (needs ImageMagick 7; `NOTE` in the script picks the sketch); committed, not built.

**The Foundry/PF2e API, compendium packs, Svelte-in-ApplicationV2, the Vite build, and
multi-client sync live in the user-level `foundry-pf2e` skill** — consult it for any of
those (it loads on demand, so this file stays lean). Here: only the hard rules and
what's specific to this repo.

New module from this template: `npm run init -- <new-id> [--title "..."]` rewrites the
id/title everywhere and deletes the init script. See README.

Code style: global `~/.claude/CLAUDE.md` — comment only the non-obvious *why*.

## Hard rules (override defaults)

- **No setting proper nouns.** Paizo reserves every person, place, faction, deity and event name
  from its Pathfinder setting; none may appear in content, file names or slugs. Use the established
  stand-ins: the King, the King's city and "royal", the Fey Queen, the Trickster Lord, the elder fey,
  the fey realm, the borderlands, the Skyfall and the Skyfall Wastes ("skyfall"), the salvage towns,
  hill-clan, horse-clan, the Giant Lord, the Wyvern Queen, the black dragon. Book titles appear only
  as source credits; the `pf2e-kingmaker` module id stays where code and setup need it. Names this
  project invented stay, and so does the Wild Hunt, which is older folklore.
- **v14 only, no v1 APIs.** Everything under `foundry.*`. Never `foundry.appv1`, bare
  `Application` / `FormApplication` / `Dialog`, or bare `mergeObject` / `duplicate` /
  `getProperty`. Windows are ApplicationV2; dialogs DialogV2; structured data is
  `foundry.abstract.DataModel` + `defineSchema()`. A v1-only class → find the V2 form first.
- **TypeScript everywhere, including tooling.** `vite.config.ts`, `svelte.config.ts`,
  and `scripts/*.ts` run via `node` (≥22.18 strips types by default — no `tsx`/`ts-node`). No
  `.mjs`/`.js` tooling. `package.json` pins `engines.node`.
- **UI is Svelte 5 mounted in an ApplicationV2 shell** (`mount`/`unmount`, runes) — not
  Svelte 4 forms (`new Component()`, `$destroy`, `export let`). See the skill's
  `svelte-in-applicationv2.md`.

## Build & dev

- `npm run build` → builds `packs/` from `packs/_source/` **and** `dist/` (both gitignored;
  build before enabling a world, and after edits).
- `npm run dev` — HMR dev server (`:30001`, proxies Foundry). `npm run watch` — `vite build --watch`.
  `npm run check` — `svelte-check` + `tsc`. `npm run setup` —
  resolve dev paths (detect/clone/prompt), then scaffold the Foundry module dir + pull references in.
- **Test (verification loop):** `npm test` — vitest unit specs (zero-setup, the CI tier:
  `.github/workflows/ci.yml` runs `check` + `npm test` on every push to `main` and every PR,
  needs no secrets or Foundry install). `npm run test:e2e` — Playwright against a real headless
  Foundry (opt-in; needs a licensed Foundry + a migration-current pf2e world, so it's excluded
  from CI). Tiers, commands, preconditions, the check-harness-health discipline, and spec
  conventions live in the skill's `references/testing.md`.
- **Two ways the module lands in Foundry** (both put it at `modules/<id>/`):
  - `npm run setup` (dev) — a **real** module dir whose entries (`module.json`, `dist`, `lang`,
    `packs`, `assets`) symlink back to the repo, so edits + Vite HMR are live. NOT a whole-repo
    symlink (that leaked `node_modules`/`.git` and shipped no assets).
  - `npm run deploy` — `vite build`, then **copy** a clean, link-free, self-contained dir
    (same shape as the release zip). Use to test the shipped artifact or install without the repo.
- Art has **one source and one output**: it lives once in top-level `assets/` (beside `lang/`,
  `packs/`; not under `src/`, which is for built code) and ships once as a served file at
  `modules/<id>/assets/…` (dev symlink / `deploy` copy / release zip). **Reference it by that
  path** — from scene/tile content and from code alike (kingmaker and abomination-vaults do
  exactly this; their esmodules embed zero assets). Do NOT `import` art: in the lib build an
  import inlines a *second* copy into `dist/<id>.js`. When code needs an SVG's shapes live (e.g.
  to animate them), `fetch()` the served file and inline it (see `src/ui/components/example/RuneGoblinBadge.svelte`).
  The served path must resolve in dev, `deploy`, and the release zip.
- Active install: `FoundryVTT` (a fresh v14 desktop install may use `FoundryVTT-v14`).
  References: `_pf2e-source`, `_foundry-data`, `_foundry-modules`.

## This repo's specifics

- Module id `points-of-interest`; flags, settings, the socket channel (`module.<id>`),
  and pack names (`<id>.<pack>`) all key off it. Use `const MODULE_ID`.
- Public API: `game.modules.get(MODULE_ID).api = {...}` (cast — `api` isn't typed on `Module`).
- Strings: `lang/en.json` under `points-of-interest.*`; `game.i18n.localize/format`. No hard-coded strings.
- compatibility `minimum "14"`, `verified "14"`; MIT license. Author and the `url`/`manifest`/`download` org come from `npm run init` (committed as `<your-name>`/`<your-org>` placeholders until then).
- Release: tag `vX.Y.Z` → `release.yml` stamps the version, type-checks, builds, publishes `module.json` + `points-of-interest.zip` (zip ships `dist lang packs assets` — must include the art).

## Gotchas

- Compendium packs build from `packs/_source/<name>` → `packs/<name>` on `npm run build`
  (`scripts/pack.ts`; built LevelDB gitignored like `dist/`). Edit the JSON sources, not the
  LevelDB. If Foundry holds a pack open the build skips it with a warning (LevelDB lock) —
  close Foundry to refresh. `npm run init` rewrites the sources so a generated module's packs
  carry its id after the next build. Pack workflow: skill's `packs-cli.md`.
- **Distribution is derived, not a mode.** `scripts/pack.ts` ships what `module.json` registers:
  register an `Adventure` pack and `npm run build` *derives* it from the per-type sources
  (`scripts/build-adventure.ts`, keepId import → ids preserved → cross-links hold); register none
  and you get plain compendia. Runtime libraries (effects a rule grants in place by compendium UUID)
  go under `packs/_source/_library/<name>/` so they ship as compendia and stay out of the Adventure.
  Sources stay canonical (compendium UUIDs); the build rewrites bundled-pack refs to world UUIDs,
  `scripts/normalize-refs.ts` rewrites them back after an unpack. Don't default to an Adventure —
  imported docs are copies that go stale on module update; only *worlds to run* warrant it. Runtime
  side: `promptAdventureImport()` in `src/adventure.ts` (self-deactivates with no Adventure pack).
  Decision guide + workflow: README "Ship as an Adventure" and the skill's `packs-cli.md`.
- `dist/` is gitignored — served via the dev scaffold's `dist` symlink after build; CI builds it for releases.
- Vite does **not** type-check — run `npm run check` (the release workflow does too).
- `npm run dev` = Vite HMR dev server on `:30001` reverse-proxying Foundry (`:30000`). It proxies an *already-running* Foundry — start Foundry and **launch a world with the module enabled** first, or there's no esmodule to hot-swap. Then browse `:30001/game` (not `:30000`). `.svelte` edits hot-swap; editing `src/index.ts` full-reloads. `npm run watch` = old `vite build --watch` (browse `:30000`, manual F5; Foundry hot-reloads `.hbs`/`.css`/`.json` but not esmodules).
- Persist state in document flags, not raw socket; raw socket for transient signals only (skill's `multi-client-sync.md`).

## Status and next steps

- Done: module scaffold, art in `assets/`, encounter docs, and the Adventure pack `adventure`, the only
  pack `module.json` registers. It is built from the per-type sources: the generated journal, scenes
  (22, every token at its starting spot from the encounter text, loot where it lies; no walls/lights),
  actors (102, including 2 hazards, 8 loot remains and 16 treasure caches; one folder per encounter) and
  the hand-authored macro (`packs/_source/macros/`, ids from `ids.macro`). Runtime code that imports a
  piece on its own (map notes, scene cards, actor links) reads the Adventure through `adventureContent()`
  in `src/adventure.ts`; don't register the per-type packs, so the sidebar shows one entry.
- Map notes: a GM runs the "Place the King's Map Notes" macro, which calls
  `game.modules.get('points-of-interest').api.placeMapNotes(scene?)`. It targets the given scene, else
  the viewed region map, else the world's only one (several and none viewed → asks the GM to view one).
  It imports or refreshes the journal into a "Points of Interest" world folder (same ids as the Adventure),
  deletes the per-site entries v0.2.0 made and the old King's Note image pages, adds the `scene` note to world copies of the module scenes
  that lack it (refreshing the link of one already there), then creates or moves one note per site (318 px icon, one hex tall,
  linked to the site's encounter page, flagged `site`). Re-run it after journal edits.
  The module hides Foundry's dark backing square and idle border on these notes (`refreshNote` hook).
- The desktop install links the module as `npm run setup` would (`Data/modules/points-of-interest`
  symlinks into the repo). The stolen-lands world already holds the journal folder and the 21 notes;
  enable the module there after a Foundry restart to get the hook and the API.
  A new world journal gives players Limited ownership: they see each pin and its name but can't read
  a page. Share the King's note by clicking it on its encounter page and pressing Show Players. Keep the
  journal free of image pages: Foundry lets Limited players open an image page straight from its pin.
- Next: check the actor sheets, scene grids and token placement in a live world, trace walls and lights.
- Assumptions: party of 4 PCs at level 16. The annihilator robot (#21) is a custom PF2e conversion;
  its stat block lives in `docs/encounters.md`. #9 uses the elite adamantine golem from the system's Kingmaker bestiary.
- Art is stored in **Git LFS** (`assets/**` in `.gitattributes`); `release.yml` checks out with
  `lfs: true` so the zip ships the real files. Tactical maps are lossy WebP at quality 75
  (`cwebp -q 75 -m 6`); convert new maps the same way before adding them.

# Points of Interest

A Pathfinder 2e Foundry VTT module for a kingdom-building campaign at **party level 16 and up**. When the PCs take the King's city they find his map of the western borderlands, marked with sites he had been investigating. This module turns those marks into 21 encounters. Each one gets a journal page, a scene, actors, and art.

## Contents

The module ships one compendium entry, the **Points of Interest** Adventure. It holds the following.

- **Journal: Points of Interest** holds an overview with assumptions and a running order, then a page per site in encounter order. Each site opens with an establishing banner and its creature tokens. Click the banner to expand the artwork, **Show map** to expand the tactical map, or **Open scene** to view the scene; a GM's first visit imports it with its actors. Click a token to open the actor, or drag it onto a scene. Expand **The King's note & encounter details** to read the reference table and share the King's note through its image popout. Numbered features and outcome rows keep the encounter easy to scan.
- **Import:** one click brings in the journal, scenes, actors and macro under their own ids, so placed tokens and links resolve. The GM is prompted to import it once. A scene card, a journal token link or the map-notes macro brings in any piece the world lacks, straight from the Adventure.
- **Scenes:** one per tactical map, 22 in all (#9 adds the Juggernaut's cargo hold), in encounter order. Each sets a grid sized to the art, links to its encounter page and has its actors placed in a block at the centre for the GM to reposition. A journal note in the map's top-left corner opens the site's page; only the GM sees it. Later states and optional extras start hidden. They carry no walls or lights yet.
- **Macro: Place the King's Map Notes** pins all 21 sites to their hexes on the region map from the `pf2e-kingmaker` module, each with its map-note sketch as the icon and linked to the site's page in the Points of Interest journal. Players see the pins and site names but can't open the pages. The macro uses the region map you are viewing, or the world's only one, and imports the journal first. It adds the corner journal note to any copy of the module's scenes already in the world and deletes the one-entry-per-site journals that version 0.2.0 created. Running it again moves the pins back to their hexes and creates no duplicates. It arrives with the Adventure.
- **Actors:** every creature and NPC with art, 86 in one folder per encounter. Combatants use PF2e system stat blocks (Kingmaker Bestiary, Monster Core, Bestiary 2 and others), with elite adjustments where the encounter calls for them. Noncombatants use NPC Core stat blocks, remains are loot actors, and the annihilator robot and two hazards are built from `docs/encounters.md`. The Adventure ships each actor's name, art and notes with a recipe; the module builds the stat block from your installed PF2e system when the actor enters a world, by Adventure import, scene card, journal link or drag. A GM never runs anything for it. After a module update that changes an actor, the module offers to rebuild that world's copies.

## Layout

| Path | Contents |
|---|---|
| `docs/encounters.md` | Canonical encounter text; the journal builds from it |
| `docs/art/` | Art briefs per encounter, plus `by-type/` views |
| `docs/pitches.md` | Original encounter pitches |
| `assets/map-notes/white-ink/` | The King's map notes |
| `assets/maps/` | Tactical maps |
| `assets/establishing/` | Journal banners; each shares its scene map's filename |
| `assets/portraits/`, `assets/tokens/` | Character art; a portrait and its token share a file name |
| `packs/_source/` | Per-type JSON sources the Adventure is built from (journals and scenes are generated) |
| `scripts/build-journal.ts` | Markdown-to-journal generator |
| `scripts/build-scenes.ts` | Scene generator; grid sizes per map live in its table |
| `scripts/build-actors.ts` | Actor generator; reads an installed PF2e system, output committed |
| `assets/maps/thumbs/` | Scene thumbnails, generated once and committed |

## Develop

```bash
npm install
npm run build     # generate scenes and journals, compile packs, build dist/
npm run check     # svelte-check + tsc
npm run setup     # link the module into your local Foundry data dir
```

Close Foundry before `npm run build` so the packs aren't locked.

`npm run build` does not touch the actors. Regenerate them after editing `scripts/build-actors.ts` or updating the PF2e system:

```bash
npm run build:actors -- --system "<Foundry data>/systems/pf2e"   # or $PF2E_SYSTEM, or the default install path
```

It reads only the PF2e system's own compendia, never the premium `pf2e-kingmaker` module, and writes recipes rather than copies. `npm test` also runs `actors.hydrated.test.ts` against an installed PF2e system; run it after each PF2e update.

Art in `assets/` is stored in Git LFS. Install it once (`brew install git-lfs`, then `git lfs install`) before cloning. Convert new tactical maps to lossy WebP at quality 75 before adding them:

```bash
cwebp -q 75 -m 6 input.png -o assets/maps/NN-name.webp
```

## License

MIT for code. All art in `assets/` is original to this project. The Adventure ships no PF2e content: the module loads creature statistics from the PF2e system installed in your Foundry.

## Community Use

This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

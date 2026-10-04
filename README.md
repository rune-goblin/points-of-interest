# Points of Interest

A Pathfinder 2e Foundry VTT module for **Kingmaker, Chapter 8 onward**. When the PCs take Pitax they find Irovetti's map of the western Stolen Lands, marked with sites he had been investigating. This module turns those marks into 21 encounters. Each one gets a journal page, a scene, actors, and art.

## Contents

- **Journal: Irovetti's Map** holds an overview with assumptions and a running order, then a page per site, grouped by zone. Each site page shows a preview of its scene and the tokens of the creatures on it. Click a preview to view the scene; a GM's first click imports it with its actors. Click a token to open the actor, or drag it onto a scene. Irovetti's note follows each site page as a handout image page.
- **Adventure: Irovetti's Map** bundles the journals, scenes and actors for a one-click import that keeps every id, so placed tokens and links resolve. The GM is prompted to import it once.
- **Scenes:** one per tactical map, 22 in all (#9 adds the Juggernaut's cargo hold), filed by zone. Each sets a grid sized to the art, links to its encounter page and has its actors placed in a block at the centre for the GM to reposition. A journal note in the map's top-left corner opens the site's page; only the GM sees it. Later states and optional extras start hidden. They carry no walls or lights yet.
- **Macro: Place Irovetti's Map Notes** pins all 21 sites to their hexes on the Kingmaker Stolen Lands map, each with its map-note sketch as the icon and linked to the site's page in the Irovetti's Map journal. Players see the pins and site names but can't open the pages. The macro uses the Stolen Lands map you are viewing, or the world's only one, and imports the journal first. It adds the corner journal note to any copy of the module's scenes already in the world and deletes the one-entry-per-site journals that version 0.2.0 created. Running it again moves the pins back to their hexes and creates no duplicates. It ships in the Macros compendium and arrives with the Adventure.
- **Actors:** every creature and NPC with art, 86 in one folder per encounter. Combatants copy PF2e system stat blocks (Kingmaker Bestiary, Monster Core, Bestiary 2 and others), with elite adjustments where the encounter calls for them. Noncombatants copy NPC Core stat blocks, remains are loot actors, and the annihilator robot and two hazards are built from `docs/encounters.md`.

## Layout

| Path | Contents |
|---|---|
| `docs/encounters.md` | Canonical encounter text; the journal pack builds from it |
| `docs/art/` | Art briefs per encounter, plus `by-type/` views |
| `docs/pitches.md` | Original encounter pitches |
| `assets/map-notes/` | Irovetti's map notes |
| `assets/maps/` | Tactical maps |
| `assets/portraits/`, `assets/tokens/` | Character art; a portrait and its token share a file name |
| `packs/_source/` | Compendium JSON sources (journals and scenes are generated) |
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
npm run build:actors -- --system "<Foundry data>/systems/pf2e"   # defaults to _foundry-data/systems/pf2e
```

It reads only the PF2e system's own compendia, never the premium `pf2e-kingmaker` module.

Art in `assets/` is stored in Git LFS. Install it once (`brew install git-lfs`, then `git lfs install`) before cloning. Convert new tactical maps to lossy WebP at quality 75 before adding them:

```bash
cwebp -q 75 -m 6 input.png -o assets/maps/NN-name.webp
```

## License

MIT for code. All art in `assets/` is original to this project. Creature statistics in the actors pack come from the PF2e system's compendia and keep their OGL 1.0a or ORC licence.

## Community Use

This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

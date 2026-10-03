# Points of Interest

A Pathfinder 2e Foundry VTT module for **Kingmaker, Chapter 8 onward**. When the PCs take Pitax they find Irovetti's map of the western Stolen Lands, marked with sites he had been investigating. This module turns those marks into 21 encounters. Each one gets a journal page, a scene, actors, and art.

## Contents

- **Journals:** an overview entry with assumptions and a running order, then one entry per site. Each site entry holds Irovetti's note as a handout image page and the encounter text, which opens with links to the site's scene and actors.
- **Adventure: Irovetti's Map** bundles the journals, scenes and actors for a one-click import that keeps every id, so placed tokens and links resolve. The GM is prompted to import it once.
- **Scenes:** one per tactical map, 22 in all (#9 adds the Juggernaut's cargo hold), filed by zone. Each sets a grid sized to the art, links to its encounter page and has its actors placed in a block at the centre for the GM to reposition. Later states and optional extras start hidden. They carry no walls or lights yet.
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

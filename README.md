# Points of Interest

A Pathfinder 2e Foundry VTT module for **Kingmaker, Chapter 8 onward**. When the PCs take Pitax they find Irovetti's map of the western Stolen Lands, marked with sites he had been investigating. This module turns those marks into 21 encounters. Each one gets a journal page, a scene, actors, and art.

## Contents

- **Journal: Irovetti's Map: Encounters** has an overview with assumptions and a running order, then one page per encounter. Each page opens with Irovetti's map note.
- **Journal: Irovetti's Map: Notes (Handouts)** has the 21 map notes as image pages to show players.
- Scenes and actors come next.

## Layout

| Path | Contents |
|---|---|
| `docs/encounters.md` | Canonical encounter text; the journal pack builds from it |
| `docs/art/` | Art briefs per encounter, plus `by-type/` views |
| `docs/pitches.md` | Original encounter pitches |
| `assets/map-notes/` | Irovetti's map notes |
| `assets/maps/` | Tactical maps |
| `assets/portraits/`, `assets/tokens/` | Character art; a portrait and its token share a file name |
| `packs/_source/` | Compendium JSON sources (journals are generated) |
| `scripts/build-journal.ts` | Markdown-to-journal generator |

## Develop

```bash
npm install
npm run build     # generate journals, compile packs, build dist/
npm run check     # svelte-check + tsc
npm run setup     # link the module into your local Foundry data dir
```

Close Foundry before `npm run build` so the packs aren't locked.

Art in `assets/` is stored in Git LFS. Install it once (`brew install git-lfs`, then `git lfs install`) before cloning. Convert new tactical maps to lossy WebP at quality 75 before adding them:

```bash
cwebp -q 75 -m 6 input.png -o assets/maps/NN-name.webp
```

## License

MIT for code. All art in `assets/` is original to this project.

## Community Use

This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

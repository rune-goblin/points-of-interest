# Journal art sources

This folder keeps the full-size originals behind the journal graphics in `assets/journal/`, and the images the generator used as references. The module ships smaller WebP exports; re-export from these files when a runtime asset needs a new crop or size. Git LFS stores the images.

## Encounter drawings

[The encounter index](encounters/README.md) lists the 63 original PNGs: a creature, a location, and a clue for each encounter. [The gallery](encounters/index.html) shows them in both themes. [The illustration guide](../journal-illustrations.md) covers placement and export, and [the prompt record](../journal-illustrations.json) holds every prompt and crop. `scripts/export-journal-illustration.ts` reads the record to make the runtime copies.

## Illuminated initials

The generator drew T first and used it as the style reference for A, H, M, and O. 256px WebP copies ship in `assets/journal/initials/`. [The prompt record](../journal-initials.json) holds the inputs.

| Initial | Original | Runtime asset |
|---|---|---|
| A | [PNG](illuminated-a.png) | [WebP](../../../assets/journal/initials/a.webp) |
| H | [PNG](illuminated-h.png) | [WebP](../../../assets/journal/initials/h.webp) |
| M | [PNG](illuminated-m.png) | [WebP](../../../assets/journal/initials/m.webp) |
| O | [PNG](illuminated-o.png) | [WebP](../../../assets/journal/initials/o.webp) |
| T | [PNG](illuminated-t.png) | [WebP](../../../assets/journal/initials/t.webp) |

## Margin ornaments and frame pieces

[The ornament guide](../journal-marginalia.md) sets the placement rules, and [the prompt record](../journal-marginalia.json) holds the inputs and export bounds.

| Element | Original | Runtime asset |
|---|---|---|
| Raven | [PNG](raven-branch.png) | [WebP](../../../assets/journal/marginalia/raven-branch.webp) |
| Moon | [PNG](moon-vine.png) | [WebP](../../../assets/journal/marginalia/moon-vine.webp) |
| Berries | [PNG](berry-sprig.png) | [WebP](../../../assets/journal/marginalia/berry-sprig.webp) |
| Oak | [PNG](oak-sprig.png) | [WebP](../../../assets/journal/marginalia/oak-sprig.webp) |
| Blue flowers | [Earlier sprig](references/background-sprig.webp) | [WebP](../../../assets/journal/marginalia/blue-flower-sprig.webp) |
| Read-aloud corner | [PNG](read-aloud-corner-simple.png) | [WebP](../../../assets/journal/read-aloud-corner-simple.webp) |
| Rule knot | [PNG](rule-knot-simple.png) | [WebP](../../../assets/journal/rule-knot-simple.webp) |

## Generation references

- [Night scriptorium](references/night-scriptorium.png): the layout concept the journal grew from, and the style reference for the ornaments ([prompt](../journal-layout-concepts.json)).
- [Earlier background sprig](references/background-sprig.webp): the source of the blue-flower ornament ([prompt](../journal-section-details.json)).
- [Earlier angular page corner](references/page-corner.webp): the reference the generator edited into `assets/journal/page-corner-filigree.webp` ([prompt](../journal-page-filigree.json)).

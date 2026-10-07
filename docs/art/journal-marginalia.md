# Journal ornament library

Five organic margin ornaments give the journal varied silhouettes. Four new illustrations join the existing blue-flower sprig. Each has a transparent background and remains separate from the text. The built-in image generator produced the artwork; [the prompt record](journal-marginalia.json) contains its inputs. [The sample index](journal-samples/README.md) holds the originals and previews.

## Margin elements

| Element | Asset | Suggested placement |
|---|---|---|
| Raven on a branch | [Raven](../../assets/journal/marginalia/raven-branch.webp) | Larger banner margin, facing inward |
| Moon above a vine | [Moon](../../assets/journal/marginalia/moon-vine.webp) | Higher, shorter counterpoint to the raven |
| Berry sprig | [Berries](../../assets/journal/marginalia/berry-sprig.webp) | Quiet section margin |
| Oak leaves and acorns | [Oak](../../assets/journal/marginalia/oak-sprig.webp) | Botanical banner or section margin |
| Blue-flower sprig | [Blue flowers](../../assets/journal/marginalia/blue-flower-sprig.webp) | Small section margin |

Flip individual ornaments horizontally with `scaleX(-1)`. Keep birds, moons, and plants upright. Preserve each asset's aspect ratio with `background-size: contain`.

## Placement rules

- Use at most four margin ornaments on an encounter page: two by the banner, one by Features, and one by Outcomes.
- Pair different elements, and vary their height and scale. Keep at least 24px between a body ornament and the reading column.
- Reserve 5rem on each side of wide banners and prose. Below a 52rem page width, hide the margin ornaments and return that space to content.
- Keep the title, artwork buttons, numbered labels, and prose clear of decoration.
- Use detailed foliage only at larger sizes. Small border graphics use broad loops and open shapes.

`illumination()` in `scripts/build-journal.ts` selects a stable arrangement for each encounter. Both the banner and body receive the same `data-illumination` value. CSS controls placement and flipping.

| Arrangement | Banner left | Banner right | Features left | Outcomes right |
|---|---|---|---|---|
| Night | Raven | Moon | Berries | Blue flowers |
| Grove | Oak | Blue flowers | Berries | Moon |
| Relic | Moon | Berries | Oak | Blue flowers |

The upper-right and lower-left outer page corners retain the larger gold filigree. The opposite ends use simple gold rules.

## Small frame elements

| Element | Asset | Display size |
|---|---|---|
| Simple corner | [Gold loops with an indigo leaf](../../assets/journal/read-aloud-corner-simple.webp) | 32px wide; 20px on narrow pages |
| Simple knot | [Four open gold loops](../../assets/journal/rule-knot-simple.webp) | 44px wide by 24px high |

The knot overlays a continuous border. Its CSS background stays transparent so it creates no rectangular gap in the rule. Arrival's title sits above the box. Read-aloud text has 48px horizontal padding, or 28px on narrow pages, to clear the corner graphics.

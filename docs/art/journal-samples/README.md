# Journal design samples

This folder holds three original imagegen concepts and successive screenshots of the journal implementation for The Shadowless Lodge. The concept PNGs preserve the original output without edits. Git LFS stores the PNG images as design references outside the module's runtime assets.

The current journal combines the Night scriptorium's panoramic banner and read-aloud box with the Royal fieldbook's section hierarchy and numbered features. Outcomes also uses a numbered list. These samples record the initial concepts and the implementation revisions. The [generation prompts](../journal-layout-concepts.json) record each art direction.

## Night scriptorium

A dark manuscript with a panoramic banner, a compact cast row, and gold illumination.

![Night scriptorium journal concept](01-night-scriptorium.png)

## Birch herbarium

Warm vellum, moss-green headings, botanical dividers, and an asymmetric opening.

![Birch herbarium journal concept](02-birch-herbarium.png)

## Royal fieldbook

Oxblood headings, numbered features, outcome rows, and restrained heraldic corners.

![Royal fieldbook journal concept](03-royal-fieldbook.png)

## Implementation output

These full-page screenshots capture the HTML/CSS preview on 7 October 2026 at a viewport width of 1200 pixels. They use the generated journal content, Establishing artwork, and Foundry/PF2e styles. The preview renders check and document links for display.

### Asymmetric margin ornaments

The journal uses a five-element library: raven, crescent moon, berries, oak leaves, and blue flowers. Different motifs flank the banner at unequal heights and sizes. Smaller sprigs sit outside Features and Outcomes. Three stable arrangements vary their use across encounters, with horizontal flips where needed. The outer page retains an upper-right and lower-left filigree corner.

Wide pages reserve 5rem gutters. Below a 52rem page width, the margin ornaments disappear and the content recovers that space. [The library guide](../journal-marginalia.md) records the assets and placement rules; [the prompt record](../journal-marginalia.json) records the built-in image generator's inputs.

![Margin ornament library on ivory and charcoal](output-margin-library.png)

The read-aloud frame uses a simpler corner graphic, and the center knot has a fully transparent background. Continuous gold rules run behind the knot. Arrival's text has 48px horizontal padding, or 28px on narrow pages, clear of the 32px or 20px corner ornaments.

![Asymmetric journal banner with raven and moon](output-margins-light-top.png)

[Full light page](output-light-margins.png) · [Full dark page](output-dark-margins.png) · [Grove arrangement](output-margins-grove.png) · [Relic arrangement](output-margins-relic.png)

[Dark banner](output-margins-dark-top.png) · [Features margin](output-margins-features.png) · [Outcomes margin](output-margins-outcomes.png)

![Simpler read-aloud frame with transparent center knot](output-arrival-simple-dark.png)

[Light Arrival](output-arrival-simple-light.png) · [Narrow Arrival](output-arrival-simple-narrow.png)

Original generated PNGs: [raven](raven-branch.png), [moon](moon-vine.png), [berries](berry-sprig.png), [oak](oak-sprig.png), [simple corner](read-aloud-corner-simple.png), and [simple knot](rule-knot-simple.png).

### Arrival heading above the frame

Arrival's title sits fully above the read-aloud box with a 12px gap. A small knotwork ornament marks the center of the top border, while the lower line stays continuous. The text keeps its left alignment and 18px size. The frame reuses the existing knotwork asset.

![Arrival heading above its frame in the light theme](output-arrival-above-light.png)

![Arrival heading above its frame in the dark theme](output-arrival-above-dark.png)

[Narrow Arrival](output-arrival-above-narrow.png) · [Full light page](output-light-arrival-above.png) · [Full dark page](output-dark-arrival-above.png)

### Illuminated Background initials

Every Background now opens with a freestanding gold-and-indigo capital. Curved foliage grows from the letter; transparency preserves the page around and within it. The initial occupies three lines of prose and replaces the separate botanical sprig. The complete first word remains available to screen readers and text selection.

The built-in image generator created T first, then used it as the style reference for A, H, M, and O. The [prompt set and inventory](../journal-initials.json) record the generation inputs. The original PNGs remain here; 256px WebP copies ship in `assets/journal/initials/`.

| Initial | Backgrounds | Original | Runtime asset |
|---|---:|---|---|
| A | 5 | [A](illuminated-a.png) | [WebP](../../../assets/journal/initials/a.webp) |
| H | 2 | [H](illuminated-h.png) | [WebP](../../../assets/journal/initials/h.webp) |
| M | 1 | [M](illuminated-m.png) | [WebP](../../../assets/journal/initials/m.webp) |
| O | 1 | [O](illuminated-o.png) | [WebP](../../../assets/journal/initials/o.webp) |
| T | 12 | [T](illuminated-t.png) | [WebP](../../../assets/journal/initials/t.webp) |

![All five illuminated Background initials in both themes](output-background-initials.png)

[Full light page](output-light-initials.png) · [Full dark page](output-dark-initials.png) · [Narrow Background](output-narrow-initials.png)

[Light Background detail](output-background-initial-light.png) · [Dark Background detail](output-background-initial-dark.png)

### Clear hierarchy, light theme

The type scale uses a perfect fifth: each heading step multiplies the preceding size by 1.5. The body starts at 18px, with 27px leading. Captions and controls use 14px. The pixel values below assume a 16px root size; CSS sets the sizes in rem.

| Role | Font size | Line height |
|---|---:|---:|
| Cast labels and buttons | 14px | 17.5px |
| Prose, metadata, and tables | 18px | 27px |
| H3 subheadings | 27px | 32.4px |
| H2 section headings | 40.5px | 48.6px |
| H1 on narrow pages | 54px | 64.8px |
| H1 on wide pages | 60.75px | 72.9px |

This revision placed Background's sprig on the right, clear of the text. Arrival aligns left at every width, and its title shares the frame's top center line. All journal text is free of shadows. Paragraph, group, and section gaps remain 12, 24, and 36px.

![Journal with larger headings and 18px prose in the light theme](output-light-hierarchy.png)

### Clear hierarchy, dark theme

![Journal with larger headings and 18px prose in the dark theme](output-dark-hierarchy.png)

### Compact feature badges

Simple 26px indigo circles with thin gold borders replace the illustrated medallions. Each 16px number sits at the circle's center; the badge aligns with the label's first text line.

![Small centered feature badges aligned with their labels](output-features-hierarchy.png)

### Numbered outcomes

Outcomes uses a numbered list with bold run-in labels. The section has an open layout with space between entries.

![Numbered outcomes with bold labels](output-outcomes-hierarchy.png)

### Left-aligned read-aloud text

The 390px viewport preserves the 18px prose, left alignment, and curved gold frame.

![Narrow journal with left-aligned Arrival text](output-narrow-hierarchy.png)

### Clear reward labels

XP, Treasure, and Kingdom labels use plain gold text. The page ends with the mirrored filigree band.

![Rewards and Scaling without text shadows](output-footer-hierarchy.png)

### Connected filigree bands, light theme

Double gold rules join the curved page corners and central knot into one horizontal band. The footer mirrors the entire band vertically. CSS stretches the rules as the page changes width while the ornaments retain their proportions. The composition reuses the existing artwork.

Arrival's title sits across the read-aloud frame's top rule. The title, rule, and curved corner ornament share a center line. Other sections retain their own treatments.

![Journal with connected filigree bands in the light theme](output-light-connected-bands.png)

### Connected filigree bands, dark theme

![Journal with connected filigree bands in the dark theme](output-dark-connected-bands.png)

### Arrival rule alignment

![Arrival title centered on the gold rule between curved ornaments](output-arrival-connected-rule.png)

### Mirrored footer band

![Footer with a continuous gold band and upward-facing filigree](output-footer-connected-band.png)

### Panoramic banner and read-aloud box, light theme

The wide establishing image and cast row return to a continuous dark banner. The title uses one gold color and one font. [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) gives H1 and H2 their irregular serif shapes at the existing scale. Bold Gelasio marks H3s, while body text stays at 16/24px. The module bundles the heading font and its license for local use.

A single gold-and-blue sprig accompanies Background. Read-aloud passages have their own flexible double gold border and four curved knotwork corners. Their text centers on wide pages and aligns left on narrow pages. Numbered medallions mark Features; Outcomes retains its ledger. Each treatment belongs to its section.

![Panoramic journal banner and read-aloud box in the light theme](output-light-banner-box.png)

### Panoramic banner and read-aloud box, dark theme

![Panoramic journal banner and read-aloud box in the dark theme](output-dark-banner-box.png)

### Narrow read-aloud box

This 390px viewport excerpt shows the sprig with wrapping prose and the read-aloud frame around left-aligned text.

![Narrow journal layout with framed read-aloud text](output-narrow-banner-box.png)

### Harmonic typography, light theme

This earlier revision introduced a major-third type scale: each step multiplies the preceding size by 1.25. Shared CSS variables set sizes in rem; these pixel values assume a 16px root size. The current implementation uses the larger perfect-fifth scale above.

| Role | Font size | Line height |
|---|---:|---:|
| Cast labels and buttons | 12.8px | 16px |
| Prose, metadata, and tables | 16px | 24px |
| H3 subheadings | 20px | 24px |
| H2 section headings | 25px | 30px |
| H1 on narrow pages | 31.25px | 37.5px |
| H1 on wide pages | 39.06px | 46.88px |

Every H2 uses the same size and weight. Color, rules, and ornament distinguish sections. Arrival uses the same prose size and leading as Background and Features. Paragraphs have a 12px gap, feature items have a 24px gap, and sections have a 36px gap. Explicit margins prevent Foundry's default paragraph and list spacing from adding extra gaps. The opening panel, curved page filigree, Arrival frame, and numbered medallions remain intact.

![Journal with a shared type scale in the light theme](output-light-type-scale.png)

### Harmonic typography, dark theme

![Journal with a shared type scale in the dark theme](output-dark-type-scale.png)

### Curved filigree, light theme

This revision introduced open gold-leaf scrollwork, curved indigo ribbons, and transparent spaces between the leaves. The inner edge follows the foliage. The outer gold rules retain the page's alignment, and the oxblood Arrival frame remains distinct.

![Journal with curved gold-leaf filigree in the light theme](output-light-filigree.png)

### Curved filigree, dark theme

![Journal with curved gold-leaf filigree in the dark theme](output-dark-filigree.png)

### Panel layout, light theme

This earlier layout places a single scene beside its cast and Background on wide pages. Narrow pages stack the artwork, cast, and text. Sites with several scene blocks keep each cast beneath its own image. Reading columns stay within 68ch on a page up to 60rem wide.

Indigo-and-gold corners mark the page boundary. Larger oxblood stepped corners frame Arrival at heading height. Feature numbers sit inside illustrated medallions, while Outcomes uses a ledger and Rewards and Scaling form a quieter footer.

![Journal panel layout in the light theme](output-light-panels.png)

### Panel layout, dark theme

The same hierarchy uses ivory text and saturated vermilion headings on charcoal. The dark title panel and the artwork actions remain consistent across themes.

![Journal panel layout in the dark theme](output-dark-panels.png)

### Refined light theme

The revision uses an antique-gold title with a vermilion initial, a gold banner frame, oxblood section headings, and larger corner ornaments on warm vellum.

![Refined journal implementation in the light theme](output-light-refined.png)

### Refined dark theme

The dark theme pairs saturated vermilion headings with charcoal, ivory text, antique gold, and indigo details. The preview loads fonts and icons directly from the local Foundry and PF2e installations.

![Refined journal implementation in the dark theme](output-dark-refined.png)

### Initial light theme

![Journal implementation in the light theme](output-light.png)

### Initial dark theme

![Journal implementation in the dark theme](output-dark.png)

## Decoration assets

The built-in imagegen tool produced these transparent graphics. CSS mirrors the corners. Earlier revisions overlaid live numbers on the illustrated medallion; the current badges use CSS circles.

| Decoration | Asset | Generation prompt |
|---|---|---|
| Read-aloud box corner | [Curved gold knotwork](../../../assets/journal/read-aloud-corner.webp) | [Section detail prompts](../journal-section-details.json) |
| Earlier Background sprig | [Gold leaves and blue flowers](../../../assets/journal/background-sprig.webp) | [Section detail prompts](../journal-section-details.json) |
| Outer page filigree | [Gold leaves and indigo ribbons](../../../assets/journal/page-corner-filigree.webp) | [Filigree edit prompt](../journal-page-filigree.json) |
| Earlier angular page corner | [Indigo and gold](../../../assets/journal/page-corner.webp) | [Page corner prompt](../journal-page-corner.json) |
| Arrival section corner | [Oxblood and gold](../../../assets/journal/manuscript-corner.webp) | [Section corner prompt](../journal-corner.json) |
| Earlier feature medallion | [Indigo and gold](../../../assets/journal/feature-medallion.webp) | [Medallion prompt](../journal-medallion.json) |

## Supplied references

The pasted SVG files contain embedded raster images. The original [mask](references/user-mask.svg) and [frame](references/user-frame.svg) remain here unchanged. The third attachment duplicates the frame file.

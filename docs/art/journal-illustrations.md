# Encounter manuscript illustrations

Each of the 21 encounters has three drawings: a creature or antagonist, a location, and a story object or clue. The set contains 63 distinct illustrations. Their subjects come from `docs/encounters.md`; existing creature portraits and Establishing artwork supply visual references.

The drawings imitate a medieval monk's marginal sketches. Uneven ink contours, slightly exaggerated poses, sparse lapis and vermilion washes, and warm gold-ochre lines give them character. A curious shadow peers over its jar, the troll's heads argue, and a mechanical orrery peers through its own rings. Story content carries the illustration; the subjects remain free of ornamental frames and filler foliage.

The built-in image generator produced the images. [The prompt record](journal-illustrations.json) contains every prompt, reference, source file, original PNG, runtime WebP, and export crop. [The image index](journal-sources/encounters/README.md) links all 63 drawings.

## Placement

- Creature drawings sit left of Running the encounter; detail drawings sit right of Rewards. Both occupy 8rem by 20rem areas with equal offsets from the reading column. Each drawing retains its proportions and its own silhouette.
- Wide pages reserve 10rem prose gutters on each side. Pages below 52rem hide these two margin drawings and give that space to the text.
- A wide location sketch separates Features from Running the encounter. It occupies at most 28rem by 12rem and scales down with the reading column.
- Reading columns remain within 68ch; the overall page extends to 68rem to accommodate the larger drawings.
- The artwork has true alpha transparency, clear space around its edges, and no text shadows. Decorative images have empty alt text, `aria-hidden`, and no popout behavior. The journal prose carries the encounter information.
- The existing generic margin library remains active beside the banner and Outcomes.
- Existing page bands and read-aloud corners retain their mirrored frames. Story drawings appear once each on a page.

## Asset storage

Runtime images live in `assets/journal/encounters/NN-encounter/{creature,location,detail}.webp`. Original PNGs live under the matching directory in `docs/art/journal-sources/encounters/`. Git LFS stores both formats.

`scripts/export-journal-illustration.ts` checks the generated alpha, preserves the original PNG, and crops the runtime copy to the 1% alpha visibility bounds with 2px safety padding. It keeps the original alpha inside the crop. Creature and detail exports have a width of 384px; location exports have a width of 1024px.

`scripts/build-journal.ts` reads the prompt record's asset paths and verifies every image before it generates the journal pack. The pack test checks that all 21 pages use three unique images from their own encounter directory.

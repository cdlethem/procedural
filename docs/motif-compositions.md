# Motif compositions

These three browser examples show how a retained arrangement can support several visual
directions. They are original compositions, motivated by the composition tasks documented
in the local external-art research. They do not recreate an artist's work or use artwork,
SVGs, code, or other assets from those sources.

| Study | Visible result | Retained record | Appearance edits | Structural edit |
| --- | --- | --- | --- | --- |
| [Ornament poster](../packages/javascript/examples/ornament-poster/index.html) | Dense botanical poster with a calm title block | Accepted circle-placement centres, radii and source indices | Petals, leaves, abstract emblems, palette, scale hierarchy and crop | Packing density |
| [Geometric panel](../packages/javascript/examples/geometric-panel/index.html) | Offset architectural field with cropped wedges | Accepted regular-grid positions, scale and kind | Wedges/bars and palette | Grid density |
| [Orbital brush](../packages/javascript/examples/orbital-brush/index.html) | Quiet intersecting loops around three centres | Accepted resampled closed-path points | Ribbons/beads and palette | Path count |

The controls have the same behavior in each study: **M** and **C** redraw the same retained
geometry, **D** makes the named structural edit, **0** restores the authored configuration,
and **S** saves the displayed canvas. In the ornament poster, **M** cycles petals, leaves and
an original abstract emblem; **H** independently changes tiered and uniform motif scale, and
**X** independently changes the crop. The scale and crop controls preserve each retained
placement anchor while changing the complete presented geometry. The palette colors are copied
from `defaultPalettes` so the examples do not mutate the shipped palette records.

Run the examples from the repository with:

```sh
node tools/serve_survey_coverage_studies.mjs
```

Open `http://127.0.0.1:8789/packages/javascript/examples/ornament-poster/index.html`,
or replace `ornament-poster` with `geometric-panel` or `orbital-brush`. The server uses
the existing local p5 2.3.2 installation. Edit each study's `sketch.js` to replace its
marks; shared layout construction lives in `examples/motif-compositions/compositions.js`.

The [external reference collection](external-art-corpus.md) supplies composition context
from Joshua Davis and Casey Reas. The examples use original marks and make no claim to
reproduce those artists' algorithms or artworks.

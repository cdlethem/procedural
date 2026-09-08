# Typography evidence audit

**Scope.** This is a bounded retrieval of the current checked-in corpus, not a
capability admission, operation proposal, or candidate disposition. It does not
infer glyph-contour support from a sketch that happens to call `text()`.

## Method and corpus slice

I queried `data/corpus.sqlite` read-only for `sketch_techniques.technique =
"typography"` and joined its reusable-candidate rows. The query returns 15
tagged sketches and 44 candidate rows in 14 of them; `2016/Generativos/ThePiper`
has no normalized candidate row. The tag is broad: it includes sketches whose
candidate is a polygon, palette picker, shader, data-display primitive, or
quadtree rather than text machinery. That is useful negative evidence against
using the tag as a clustering decision.

The direct text-placement or glyph-stamping rows are:

| Candidate identity | Current candidate text | What the record actually computes |
| --- | --- | --- |
| `2014/Generativos/Helvetica/helve1#0` | `scatteredTextRain(text, count, font, hMin, hMax, sMin, sMax, b) -> void` | Repeatedly selects a canvas position and HSB fill, then emits one supplied word. |
| `2014/Generativos/Helvetica/helve1#1` | `stackedHeadline(text, n, size, x, y, dy, color) -> void` | Emits the same supplied word at fixed vertical offsets. |
| `2016/Generativos/textureGridText#0` | `textTrail(ch, x, y, dir, len, alpha) -> void` | Re-emits one glyph along a cardinal displacement at low alpha. |
| `2018/Generativos/numbers#0` | `advectGlyphs(glyphs, count, steps, speed, noiseScale, noisePhase, alpha, rampFrom, rampTo) -> void` | Uses glyph stamping as the visible mark while an independently computed noise field advances each trail. |
| `2018/Generativos/numbers#1` | `fadeRamp(step, steps, from, to, alpha) -> color` | Computes a trail fill ramp; it has no font or shape work. |
| `2018/Generativos/salchis#2` | `charGrid(phrase, cellSize, sizeRange, font, shadowOffset) -> void` | Picks a character from a phrase per grid cell and emits shadow then foreground text. |

`2016/Generativos/ThePiper`'s note frontmatter names `scatterWords(words, n,
cell)`, but the normalized database has no reusable-candidate row for it. It is
therefore evidence about a composition task, not an identity to merge with the
six records above. Its absent row is consistent with the repository's known
frontmatter recovery limits.

The other 38 tag-associated candidate rows are deliberately not recast as
typography operations: `taperedLine`, `hsbPoster`, `starPolygon`,
`regularPolygon`, `paletteRandom`, `forma`, `grilla`, `linea`, `Paleta`,
`tickArcPrimitive`, `dataScreenPost`, `rulerScale`, `slide`, `gridLights`,
`radar`, `donut`, `graph`, `mapPoint`, `darkestCircleField`,
`additiveArcGrain`, `permutedRGBPalette`, `paperGrain`, `hueLock`, `poly`,
`hexCell`, `rcol`, `hexWalk`, `subdivideQuads`, `iconCell`, `quadtreeSplit`,
`waveBand`, `logoStamp`, `noiseWalk`, `grainShader`, `createLine`, `grid`, and
`getColor`. In particular, `logoStamp` is placement of an existing `PShape`,
not evidence that a font can be converted to a contour or mesh.

I read the six nonstub reports named below and inspected the corresponding
upstream PDE where it exists in the pinned source checkout. The upstream
revision is `69bdd8513e4482a5e6018e36887d4bc208660eb5`; source inspection is
provenance only and no upstream code is copied here.

| Report | Note SHA-256 | Pinned source / SHA-256 | Why read |
| --- | --- | --- | --- |
| `survey/out/2014/Generativos/Helvetica/helve1/notes.md` | `3a7ca81ada05c069867ad4492c7c66db40c363fff0c92eef10094d4b26157e51` | `2014/Generativos/Helvetica/helve1/helve1.pde` / `7dbf173046f0fef43646eb6b36afd3dd5e944b617b155163ec4ed225ed1c0fd8` | Direct scatter and stacked text candidates. |
| `survey/out/2016/Generativos/textureGridText/notes.md` | `4bc549badde9c8b5e9efcbd4155f47bd8da3e420c06016942525b565759889ba` | `2016/Generativos/textureGridText/textureGridText.pde` / `66843c0d4e33f7194e65b4d23f3d5c041c7c8976e29b399bed8c98a984856f2d` | Direct glyph-trail candidate. |
| `survey/out/2018/Generativos/numbers/notes.md` | `94398ace5397871e0c9665232bd360e518c03c9d21da64c6fe0f128c2ced6508` | `2018/Generativos/numbers/numbers.pde` / `4dfec41b539a7302e7ad3d4772b76adb01d7848cadb54a414614f74f048dbc33` | Glyph marks coupled to flow/path computation. |
| `survey/out/2018/Generativos/salchis/notes.md` | `c918177c105018cf3478b8b58ed035bdbed317073d895e4da6e32ed34fb5f617` | `2018/Generativos/salchis/salchis.pde` / `b8e67822c8f968947b06700a49c36ad362e7fb4855bacb3d3022d6435a640e18` | Direct grid/phrase/shadow candidate in a shader composition. |
| `survey/out/2016/Generativos/ThePiper/notes.md` | `2fc96c6a2961d80f57fec4e7d5eb0880f191aabcb7fbb2fdece5ceecca3a9a18` | `2016/Generativos/ThePiper/ThePiper.pde` / `6c224d51d7a5b4f6257ec023df055a110614a9d88c70a4204c76fe3da9ddb596` | Tag-without-normalized-candidate and asset-dependent word scatter. |
| `survey/out/2014/Generativos/palabrasAleatorias/notes.md` | `c676a3a2f00de9d82aa2fecc8eca1736888803407a8931ca049e4c1c2bf4edc2` | `2014/Generativos/palabrasAleatorias/palabrasAleatorias.pde` / `218cfcb8c80f3915876e559fb2d095dc2cc23bc28a535a5e11a54b990cfa0c5f` | Word sourcing, baseline-sensitive placement, and async failure confounds. |

## What artists are doing

### Repetition, hierarchy, and random placement

`helve1` is a static JAVA2D composition with a 90-pixel Helvetica-Bold word
emitted 1,000 times at random canvas positions and low-saturation random HSB
fills, then five 128-pixel copies stacked at a fixed vertical interval. The
source confirms both use Processing text drawing and font selection; it first
loads a bundled `.vlw` asset and then creates a system Helvetica Bold face. The
report records that the system face was unavailable in the observed run and a
fallback rendered instead. The reusable burden is placement, repeat count,
fill selection, and baseline/alignment state; rendering a glyph remains a
font/renderer operation.

The measured evidence is uneven but informative: reducing the scatter loop
from 1,000 to 300 was subtle (`mean 0.0390`, changed fraction `0.046`), reducing
brightness 80 to 50 was large (`0.2309`, `0.814`), and widening saturation 0--20
to 0--80 was moderate (`0.0949`, `0.430`). Reducing stacked headline size 128 to
64 was subtle (`0.0129`, `0.052`), while increasing its count 5 to 20 scored
none (`0.0041`, `0.020`). These are observations of this renderer, fallback
font, word, canvas, and composition; they do not establish a portable font
metric, default, or range.

`ThePiper` has a related artist task: choose words from a loaded song lyric,
pick positions on a rotated lattice, select a size class, and draw them inside
a composition that also contains a stochastic quadtree, sampled cover-image
palette, speckles, and per-pixel grain. Its source loads both `songs.json` and
`tapa.jpg`, creates `Playfair Display`, rotates the whole composition, and
chooses words from the external lyric data. Its report finds `textAlpha` 250 to
80 moderate (`0.0538`, `0.095`) and base text size 320 to 480 large (`0.1707`,
`0.206`), but the source's random word choice and upstream data are part of the
same random stream. The note explicitly calls the lyric source, lattice, size
classes, and master rotation art decisions. This supports separating word-list
composition from any generic layout claim.

### Glyph stamps as marks, not outlines

`textureGridText` emits a random uppercase glyph per 8x8 grid cell, sometimes a
space, then repeats the same glyph along a randomly selected cardinal direction
with low alpha. A rotated seed label and its ghost copies are composition
specific. The report calls the trail loop cleanly separable from the grid, but
also identifies alphabet, pitch, grid bounds, blank rate, and label as artistic
choices. The source uses `createFont("Chivo-Bold", 96, true)`; the report says
that face was unavailable and a fallback sans serif rendered. Font substitution
therefore affects the actual stamped shapes even though the recorded sweep
changes only size, alpha, and trail length. The available changes were subtle:
96 to 48 text size (`0.0285`, `0.124`), trail alpha 6 to 30 (`0.0182`, `0.054`),
and the random trail upper bound 80 to 200 (`0.0146`, `0.028`). The alpha
reduction to 100--140 and paper-period change both scored no changed pixels.

`numbers` uses digits as repeatedly drawn marks after a separate computational
step: each trail samples a Perlin angle at its current point, advances, and
stamps the digit with a linear gray ramp. Its candidate therefore bundles a
path/field computation, repeated placement, raster text emission, and style
fade. The note says the generic element is glyph advection, yet the report also
records a missing `Archivo Black` face and fallback. The strong sweeps mostly
measure the field/path workload: noise scale ×0.1 (`0.2399`, `0.662`), ×8
(`0.2358`, `0.656`), 1,000 to 300 trails (`0.2325`, `0.613`), 200 to 50 stamps
(`0.2824`, `0.732`), and speed 0.5 to 2 (`0.2350`, `0.719`). Alpha 50 to 200
was subtle (`0.0373`, `0.085`). The report preserves a useful control: the two
noise variants multiply the same random result, so their random stream remains
aligned. It does not isolate font choice, glyph set, text alignment, or outline
geometry.

`salchis` adds a character grid over shader-treated flow-field ribbons. Per cell
it selects a character from the phrase `send nudes`, selects size as a fraction
of the cell size, draws a dark offset copy, then a white foreground copy. The
P2D source loads both shader files and `Saira-Thin`; the survey reports a font
fallback. The `cellSize` change from a random 180--320 to random 90--160 was
subtle (`0.0435`, `0.081`), but it changes the grid and glyph size together;
it does not identify independent typography sensitivities. The shader was
visibly active on a non-xvfb display in the observed baseline, another reason
that the grid cannot be treated as a font-only computation.

### Text as an async, asset-backed composition ingredient

`palabrasAleatorias` chooses a title and subtitle from an HTTP word list,
creates three Helvetica Bold sizes, adjusts subtitle position when the title
contains a descending glyph, and emits it from a background thread. Its two
normalized candidates are `taperedLine` and `hsbPoster`; there is no normalized
text helper. The source additionally contains a second network `loadStrings`
call in dead translation code. The report says frame 1 is usually only the
background because the generator runs asynchronously, and network fetches
caused failed attempts. Thus font-size and stroke-count variants scored none at
frame 1 even though the later composition differs. This is evidence for the
importance of source/asset/lifecycle conditions, not evidence for a reproducible
text layout primitive.

## Boundary: placement/composition versus shape geometry

The reviewed evidence establishes calls that ask a renderer to draw text at a
location, with a selected font, size, fill, alignment, transform, or shadow
offset. It establishes no candidate or inspected source path that extracts
glyph contours, exposes font outlines as portable geometry, triangulates glyphs,
or normalizes baselines/kerning across runtimes. `NeoGeo#2`'s `logoStamp` is an
existing-shape placement candidate, not such evidence. None of the six source
inspections converts a `PFont` to points or calls a contour API.

That means the reusable computational burden observed here separates into:

1. selection and placement policies (random scatter, fixed stack, grid cells,
   word selection, shadow offset, trail positions);
2. non-text generators that can feed those policies (noise paths, grids,
   quadtree cells, palette choices); and
3. renderer-dependent text emission (font resolution, metrics, alignment,
   rasterization, transforms, alpha compositing, P2D/JAVA2D behavior).

It does **not** provide evidence for a portable glyph-shape geometry layer.
Nor does it establish that the renderer placement calls are sufficient for a
cross-target typography contract: fallbacks occurred in four read reports, and
the P2D shader composition adds target-specific rendering dependence.

## Evidence gaps and confounds to carry forward

- **Font availability and identity.** Helvetica, Chivo-Bold, Archivo Black, and
  Saira-Thin all fell back in observed survey runs. No report gives font file
  hashes, fallback face identity, metric comparison, or a cross-target test.
- **Font metrics and text semantics.** The corpus shows manual positions and
  one descender heuristic, but does not establish portable baseline, ascent,
  kerning, ligature, shaping, right-to-left, multiline, or clipping behavior.
- **Assets and source text.** ThePiper needs `songs.json` and `tapa.jpg`;
  palabrasAleatorias needs a network word list and has async timing. Those are
  composition inputs and lifecycle dependencies, not generic text geometry.
- **Renderer dependence.** The direct examples span JAVA2D and P2D; `salchis`
  includes a shader and `numbers` uses `smooth(8)`. The current observations do
  not isolate text rasterization from alpha blending, sampling, or shader output.
- **Sensitivity confounds.** Several useful visual changes alter many coupled
  choices at once: salchis cell size also changes size range; numbers changes
  flow behavior and then stamps glyphs; ThePiper's subdivision edit shifts later
  random word choices. The async frame-1 protocol for palabrasAleatorias cannot
  judge its later text output.
- **Coverage.** Fifteen tagged sketches are not a direct family of 15 text
  operations: 38 of 44 candidate rows are non-text helpers, and one typography
  note lost its candidate row through normalization. Further evidence would need
  to distinguish a text-placement policy from a complete artwork recipe before
  any admission or signature decision.


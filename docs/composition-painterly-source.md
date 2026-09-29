# Painterly Source (brief 32)

Status: **implemented on branch `w2/painterly-source`, unreleased. Reviewed from rendered output only
(throwaway SVG surface under Chromium); not exercised through the real Studio interface.** It builds on
the merged [raster and image-structure foundation](composition-raster-structure.md) and the frozen
[reference slice](composition-reference-slice.md) boundary. Guide: `packages/instruments/guides/painterly-source.md`.

## Artist-facing brief

A recognizable picture assembled from multiscale marks whose shape and material are replaceable. The
first layer covers the subject with the coarsest brush; each finer layer marks only the places where the
paint so far still differs from the source. Marks turn along the subject's edges, take their color from
it (kept, reduced to a few colors, or mapped to a palette) and can be dots, dabs, strokes or ribbons drawn
as ink, stitches, beads, dots, rings, rosettes or arrows. Paper level, retention and an elliptical subject
window leave deliberate negative space; a bare area is transparent.

## Frozen boundary

| Piece | File | Contract |
|---|---|---|
| `paintPlan(options)`, `preparePaintPlan`, `paintLayerGeometry`, `paintCandidateCount`, `checkPaintBounds` | `composition/painterly.ts` | The producer. A deeply frozen `PaintPlan`: `marks` (stable id, layer, `Site`, centerline `Path`, sampled packed color, width/length, source attributes), index-aligned `sites` / `paths`, per-layer ranges. Cached by the raster's content hash plus every construction option (six kept); never by palette, material or retention. |
| `paintLayerMaterial`, `checkPaintMaterial`, `paintPalette`, `keepsMark` | `composition/painterly-style.ts` | Appearance only: layer plus a material choice become an ordinary `PathMaterialSpec` (ink, stitch, beads) or `MotifSpec` (dot, rings, rosette, arrow); `paintPalette` maps mark colors to an interleaved drawing palette; `keepsMark` is the one stable retention test for every material. |
| `painterlyComposition`, `painterlyPlan`, `drawPainterly`, `preparePainterly`, `paintDrawWork` | `composition/painterly-draw.ts` | JSON-compatible descriptor (bundled or `data` source), drawing through `strokeWith` / `atEach` with `pathMaterial` / `motif` or an ordinary callback per layer (`consumers.path` / `consumers.mark`), exact work estimate, cooperative preparation between layers. |
| Definition and controls | `adapters/painterly-source-instrument.ts` | Parameters, groups, defaults, validation. |

Reused, not reimplemented: `orientationField` / `orientationAt` / `orientationVector` (tangent field),
`rasterStorage` / `resizeRaster` / `srgbToLinear` / `linearToSrgb` / `LUMA` (representation, resize, colour),
`bundledRaster`, `medianCutQuantize` (existing colour reduction), `componentSeed`, `atEach`, `strokeWith`,
`motif`, `pathMaterial`. New: the coverage/error selection, the canvas model that feeds it, and the
mark-frame construction.

### The construction (see the module header for the full statement)

- Layer `k` has brush `b_k = brush * ratio^-k`, footprint `b_k * aspect` by `b_k` (dot 1, dab 1.8, stroke 3.6,
  ribbon 9) and a grid of spacing `b_k * sqrt(aspect / coverage)` anchored at the frame's top-left, so
  `coverage` is the expected number of marks over a point. Cell `(i, j)` of layer `k` is `L<k>:<i>:<j>`.
- An internal canvas records the color of the last mark over each source pixel. A candidate cell's error is
  the mean over its wanted pixels of `|blurred source - canvas| / sqrt(3)` (Euclidean, encoded sRGB; unpainted
  counts 1; the source is box-blurred at radius `b_k / 2`). A cell paints when that is **strictly** greater
  than `threshold` (and 1e-6, so threshold 0 never repaints an exact match). Cells are judged against the
  canvas as the layer begins, then stamped in draw order (seeded hash order, not scan order).
- Colour is averaged in linear light, alpha-weighted, over the same window, then encoded. The canvas keeps the
  unquantized colour, so an exact match has error exactly zero.
- Direction: half-turn blend (doubled angles) of the structure tangent and `baseAngle`, weight
  `coherence * smoothstep(0, 0.35, local coherence)`, plus a per-id stable scatter; strokes are traced through
  the field (sign follows the previous step) and cut where they would leave the frame.
- Negative space: a pixel is wanted if alpha >= 0.5, sRGB luma <= `paper` and it lies inside the subject window;
  `feather` thins the window rim by a stable per-id draw.

### Identity and seeds

Ids depend on layer and cell only. Position, jitter, angle scatter, order key and retention draw come from
`componentSeed(seed, id, purpose)`. Tests pin: adding a layer only appends the same marks; raising the threshold
gives layer 1 a subset with identical marks; palette, material, retention, colour mode never re-plan (the same
cached object is returned). Chance lives in jitter, scatter, stroke order (overlap), retention and feather;
the sample image has its own `imageVariant`. Deeper layers respond to the changed canvas when a coarser layer
changes, so deeper layers are not guaranteed to be subsets at a higher threshold (documented, not hidden).

### Limits (explicit, named controls)

Layers <= 8; candidate cells <= 240,000 (checked from controls alone, before any pixel); marks <= 40,000
(checked per layer, nothing truncated); finest brush >= 0.5 unit; analysis <= 512 px a side (box resize);
ink/stitch line weight <= 50 and motif size <= 500 (the existing consumers' limits, checked with messages naming
`brush` and `fill`); drawing budget 1,000,000 callback units, estimated exactly before painting. Orientation
sigma is capped at 16 px. Errors: `layers`, `brush`, `ratio`, `coverage`, `size`, `threshold`, `fill`.

## Controls (defaults in the instrument)

| Group | Controls | Notes |
|---|---|---|
| Source | `image` (portrait, geometry, landscape, noise), `imageVariant` | The source-image control. Host pictures arrive as a `Raster` value through the direct API; persisted instruments name bundled images only. |
| Placement | `centerX`, `centerY`, `size` | Bundled images are square; the frame preserves aspect. |
| Layers | `layers`, `brush`, `ratio`, `coverage`, `threshold` | |
| Marks | `family`, `jitter` | |
| Direction | `coherence`, `baseAngle`, `smoothing`, `scatter` | |
| Negative space | `paper`, `retention`, `subject`, [`subjectX`, `subjectY`, `feather` visible for window], proportional **Window size** (`subjectWidth`, `subjectHeight`) | Both window sizes are fractions of the picture, so scaling them together is one edit. |
| Material | `material`, `fill`, `lineWeight` (rings, rosette, arrow), `petals` (rosette) | |
| Color | `colorMode`, `colors` (reduced), `saturation` (not ramp) | |

Slider intervals: layers 1-6 (hard 8), brush 4-40 (hard 0.5-100), ratio 1.2-3.2 (hard 1.1-8), coverage 0.6-3
(hard 0.25-8), threshold 0-0.4 (hard 1), fill 0.2-1.25 (hard 0.05-2), paper 0.5-1 (hard 0-1). `visibleWhen` is
inline; the control audit (`tests/helpers/audit-controls.ts painterly-source`, 31 controls, 1,227 probes) reports
zero violations. The default palette is inert under the default colour mode (Reduced uses source colours); it
matters for Nearest palette color and Palette ramp.

## Tests and mutations

`tests/composition-painterly.test.ts` (16 tests) uses analytic images: flat picture (exact grid and candidate
counts, exact color, zero repaint at threshold 0), threshold 1 paints nothing (strictness), two-tone edge (fine
marks confined to a derived band), black/white edge (linear-light average against `linearToSrgb`), linear ramps
(tangent, coherence and half-turn blends: 60 degrees, and 175 not 85), containment and centering, id stability,
cache identity and freezing, paper/alpha/window, representation invariance (`linear f32 premultiplied` vs sRGB
bytes), named bounds, analytic material sizes and retention, exact work estimate and over-budget refusal,
median cut / palette / ramp / saturation / shade mapping, layer geometry, and instrument behaviour (conditions,
seed, preparation, cancellation, failures). **Mutations confirmed to fail (9):** `>` to `>=`; averaging in
encoded sRGB; plain instead of half-turn angle blend; gradient instead of tangent; spacing `aspect * coverage`;
unpainted counted 0; window test loosened; paper cutoff removed; blur radius zero.

## Review record

Rendered defaults on all four bundled images, three seeds each on portrait/landscape/geometry, a nine-case
structural sweep, an extremes sheet (six layers threshold 0 dense, one sparse layer with half retained, ribbons,
stitches, beads, rosettes, palette/ramp, window plus paper, 3-colour grayscale) and three existing-instrument pairs in
both orders (contour scores, motif ecologies, optical plates). Defects found and fixed: ink weight beyond the
50-unit consumer limit was reachable from the sliders (sliders narrowed, hard limits validated by name);
reduced-colour sample of 384 muddied rare colors (a yellow became khaki, seed to seed hair color changed;
now 1,024); `arrow` ignored `fill` and `saturation` did nothing under the ramp (found by the control audit; arrows
now scale by fill, saturation hidden for ramp); threshold 0 repainted flat regions because the canvas kept
8-bit-rounded colors (canvas now keeps exact colors, noise floor); a rounded constant in dot sizes; the work
estimate ignored retention for point materials.

Measured on this machine (Node 22, JS only, recording surface): first plan 86-193 ms at defaults (1.3-3.5k marks,
including image generation and orientation), 336 ms for 38,813 ribbons at size 900; drawing from the cached plan
2-10 ms at defaults and 36-47 ms at 35-39k marks; a material/color/retention edit redraws in 3-12 ms at defaults
and 75-207 ms at 35-39k marks with no re-plan; structural edit at six layers/threshold 0.02 96 ms, and 125 ms at
35k marks. These are observations, not certified slider ranges.

## Open concerns

1. **Subdivision foundation not used.** Layer sizes follow an arbitrary ratio, but quadtree cells halve; the
   error test against the running canvas is the coverage-selection the brief asks for. `subdivideImage` is a
   candidate for an adaptive brush size (leaf size as local detail scale) if wanted.
2. Median cut averages boxes that mix color families, so a very small `colors` count muddies (documented).
3. Coarse marks are opaque, so the layer hides what is beneath it except where paper, retention, fill or the
   window leave openness. Marks may overhang the frame by half a brush width (strokes are cut, caps are not).
4. The planner treats marks as opaque even where a material draws them with slight transparency.
5. Only bundled synthetic images are selectable; host images need the host's raster binding.
6. `index.ts` already contains two consecutive `return` statements in `canPrepareInstrument` (the second is
   unreachable, so `data-scores` is not marked preparable); `painterly-source` was added to the first, effective one.

# Adaptive Compartments (brief 30)

Status: **implemented on branch `w2/adaptive-compartments`, unreleased; reviewed from rendered output only.**
Built on the frozen raster/image-structure foundation ([raster inputs and image structure](composition-raster-structure.md))
and the [reference slice](composition-reference-slice.md) boundary. Not exercised through the real Studio interface.

## Artist-facing brief

An image whose detail sets the scale of its mosaic, with replaceable content per cell. Adaptive error subdivision divides a
picture into rectangles (big where flat, small where it changes); each cell carries measured attributes (mean color, darkness,
error, spread, dominant direction) and is filled by a callback: flat color, hatching along the local orientation, halftone dots,
a nested `motif`, and/or a border drawn by the existing `pathMaterial` (ink, stitches, beads). A retained fraction leaves open paper.
The default portrait shows large flat backdrop cells, hatched middle cells along outlines, and small glyph cells at the eyes.

## Files

| File | Role |
|---|---|
| `src/composition/compartments.ts` | producer: `compartmentPlan`, `coverCrop`, `keptCompartments`, `compartmentRegions` (frozen, cached by construction) |
| `src/composition/compartments-draw.ts` | consumers: `compartmentFiller`, hatch/halftone geometry, colors, work bound, descriptor, `drawCompartments`, `prepareCompartments` |
| `src/adapters/compartments-instrument.ts` | the instrument definition (`adaptive-compartments`), controls, groups, validation, descriptor resolution |
| `src/composition/image-structure.ts` | foundation addition: `orientationInRect` (tensor averaged over a pixel rectangle, then decomposed) |
| `tests/composition-compartments.test.ts` | 25 tests |
| `guides/adaptive-compartments.md` | teaching guide |

Shared-file hunks: `types.ts` (union member `{ kind: "compartments" }`), `reference.ts` (resolve/draw/prepare), `reference-composition-instruments.ts`
(definition list), `index.ts` (exports, palette, `usesSeed`), `metadata.json` (entry).

## Frozen semantics

- **Input.** A resolved `Raster` (the library never fetches or decodes). The instrument persists only technique id, scalar controls and
  palette; the source image is a validated select over the four bundled samples (`bundledRaster(id, variant, resolution)`). The
  typed descriptor also accepts `{ kind: "raster", raster }` for direct API use; the private host binds user images later.
- **Units.** `minCell`, `maxCell`, `smoothing` and the rectangle are canvas units; the crop is integer source pixels; orientation angles are
  radians (unsigned, [0, pi)), the `angle` control degrees. The cropped raster is mapped onto the rectangle with independent x/y scales
  (`coverCrop` keeps the stretch below one source pixel). `minCell` is converted to whole pixels rounding **up**, `maxCell` rounding **down**.
- **Partition.** `subdivideImage` on the crop, value `lightness`/`luminance`/`luma`/`saturation`/`alpha`, metric `variance`/`stddev`/`range`/`sse` in that
  metric's units (the instrument exposes `stddev`/`range` with the threshold as a percentage of the value range), split policy
  `quad`/`longest`/`best`. A cell splits while error > threshold or a side > `maxCell`, never below `minCell`. Ids are the foundation's
  path ids; raising the threshold only prunes (tested on random images, all metrics and policies).
- **Attributes.** Per leaf: canvas bounds, source pixel rectangle, `value` (mean of the measure), `error`, `spread` (standard deviation),
  `resolved` (`error <= threshold`; false means only `minCell` stopped it), mean color (linear-light average weighted by alpha, published as
  straight sRGB), `tone` (CIE L*/100 of that color), `coverage` (mean alpha), `orientation` (structure tensor averaged over the cell **then**
  decomposed, so opposed stripes cancel to coherence 0). Colors are computed through a float32 linear conversion: precision about 1e-7.
- **Identity and chance.** No random source touches the partition or its attributes. `seed` labels cells with `componentSeed(seed, id, "compartment")`.
  Chance enters only in `keptCompartments(…, "chance")` and the `mixing` wander of the detail classes. Retention is a stable
  per-cell draw (raising the fraction only adds cells) or a rank by an attribute keeping exactly `round(fraction × n)` cells; cells with
  zero coverage never compete.
- **Cache.** Keyed by construction only: source hash, crop, rectangle, measure, metric, threshold, limits, split, smoothing (the analysis is shared
  between seeds; the labelled plan adds the seed). Twelve plans, six analyses. Palette, filler, body, gutter, retention, border are never in the key
  (tested by plan identity).
- **Fillers** are `(surface, region, run) => void` over `inside`: `region.bounds` is the cell inset by half the gutter (local `[0,w]×[0,h]`), `region.cell` the frozen attributes.
  Cells are deeply frozen: a filler cannot change them (tested by attempted mutation). `detail` picks flat/hatch/glyph per cell by its shorter side
  (`>=` boundaries) with a stable per-cell wander of ±50%×mixing; other kinds apply everywhere. Hatch direction is the cell orientation (when coherence ≥ 0.25) plus the
  angle offset; spacing = `spacing·2^(toneResponse·(2·tone−1))`. Halftone dots: a square lattice turned to the same direction, area coverage = darkness up
  to `dotMax`. Motif: one `motif` mark (dot, rings, rosette, arrow) fitted to a fraction of the cell, turned to the direction. Border: a closed rectangular
  `Path` through the existing `pathMaterial` (ink, stitch, beads) for cells at least `borderMin` across. Colors: cell mean (`image`), nearest palette entry in
  Oklab (`palette`) or palette[0] inked by darkness (`ink`); marks use a shade of the body color moved away from it.
- **Hatching and dots are analytic on the rectangle.** The foundation region hatcher (`hatchRegionLines2D`, exact rational arithmetic) measured 1.6 ms for a
  20×14 cell (781 ms for 500 cells): too slow for thousands of cells, so a slab clip of parallel lines against the axis-aligned rectangle is used. It is
  tested against an independent count of the stripe offsets and for boundary endpoints.
- **Bounds.** ≤ 4,096 cells in the instrument (20,000 direct), ≤ 4,194,304 source pixels, drawing units (cells + hatch lines + dots + glyphs + 2 per border station)
  ≤ 80,000 estimated before drawing, and verified in tests to be ≥ the units actually charged to the composition run (default budget 100,000). Every refusal names the control.

## Controls (groups, conditions)

Source: `image`, `variant`, `resolution`, `measure`, Crop (`zoom`, `focusX`, `focusY`). Placement: `centerX`, `centerY`, Size (`width`, `height`; proportional).
Partition: `metric`, `threshold`, `split`, Cell size (`minCell`, `maxCell`; proportional). Negative space: `retained`, `keepBy`, `gutter`.
Filler: `filler`, `color`, `body`, Size classes (`hatchBelow`, `glyphBelow`; proportional), `mixing`, Lines and dots (`spacing`, `weight`, `angle`, `toneResponse`,
`dotMax`, `smoothing`), Glyph (`glyphKind`, `glyphFit`, `petals`, `opening`), Border (`border`, `borderWeight`, `borderSpacing`, `borderMin`).
Slider intervals are narrower than the hard limits (threshold 1–30 vs 0–100, minCell 3–40 vs 1–200, resolution 48–256 vs 16–512, zoom 1–4 vs 1–16).
`visibleWhen`: `hatchBelow`, `glyphBelow`, `mixing` need `filler=detail`; `spacing` needs detail/hatch/dots; `weight` detail/hatch/motif; `angle`, `smoothing` need any but flat;
`toneResponse` detail/hatch; `dotMax` dots; `glyphKind`, `glyphFit` detail/motif; `petals` also `glyphKind=rosette`; `opening` rings/rosette; border controls need `border≠none`, `borderSpacing`
stitch/beads. Left visible by design (relevance is a disjunction of a discrete choice and a numeric value): `keepBy` (matters only when `retained<1`), `weight` under `motif` with a dot glyph.
Coupled validation: `gutter < minCell`; `maxCell ≥ 2·minCell` (the pixel form is checked in the plan and names `maxCell`).

## Evidence

Tests (`tests/composition-compartments.test.ts`, 25): flat image → one cell, maxCell halving counts; leaves equal an independent recursive quadtree of the pixels for three
edge positions with mean/spread from raw pixels; linear-light color and alpha-weighted mean, hidden transparent color never contributes, transparent cells not kept; canvas-to-pixel rounding
(ceil/floor) and non-uniform-scale tiling; nesting under thresholds for every metric × policy on random rasters; seed labels only; orientation of stripes (π/2, 0, coherence cancellation), energy is the rectangle mean;
failures name controls; `coverCrop`; exact rank retention counts, chance monotone and near its fraction; gutter geometry; hatch/halftone geometry (independent stripe counts, boundary endpoints,
symmetry); detail class boundaries and mixing; colors (linear, Oklab nearest, ink opacity); recorded drawing of exact rectangles and mean colors, in-cell hatch/dots/glyph containment, border counts;
filler substitution/appearance edits never replace the plan and cells are frozen; estimated work ≥ charged work; the authored default (three classes on the portrait, unresolved cells all at minimum size);
coupled validation and `usesSeed`; hidden controls leave the drawing unchanged (draw fingerprint, plus the package-wide property test); appearance vs structural plan identity.

Mutations proven to fail the suite (10 tried, all killed): mean color in encoded space; `minCell` ceil→floor; `maxCell` floor→round; `detailed` rank inverted; gutter full instead of half;
alpha ignored in coverage; hatch stripes not centred; detail boundary `>=`→`>`; hatch tone spacing inverted; rectangle tensor summed instead of averaged (killed after adding an energy-mean assertion;
the first mean-color test could not tell the spaces apart with channel values 0 and 255, which are fixed points of the transfer curve, and now uses 128).

## Review record (rendered with a throwaway SVG surface under the render lease; not the real interface)

Defaults on all four bundled images, portrait/landscape × seeds 1–3 (and 70% chance retention), nine filler/color/retention variants, twelve structural settings (thresholds 2–15, min cell 3–40, split
policies, range metric, saturation, zoom/crop, max cell 60), twelve extreme/combined settings (dense, noise, sparse 12–30% by quiet/dark/light, beads and stitched borders, wide area, all combined),
and six layered pairs in both orders with unmodified Contour Scores, Motif Ecologies and Region Quilts.

Defects found by looking, and fixed:
1. The landscape at threshold 6 lost its ridges (flat green ground, sky only); the default is now 4.5 and the ridges and sun read.
2. Marks had too much contrast against their body (half-darkened rings/hatch made the face muddy and glyph cells noisy); the shade is now ×0.7 / +28% toward white and hatch weight 0.9, spacing 5.
3. Glyph cells at minimum size (8.75 units) were cluttered; the default smallest cell is 10, glyph limit 15.
4. At threshold 3.5 the portrait's face dissolved into hatch; 4.5 keeps the face readable while the landscape still shows its ridges. The guide's calm example (threshold 6, flat) is the clearest.
5. First error advice for the cell bound said "lower maxCell", which does the opposite; it now says raise the threshold, the smallest cell or the largest cell.
6. The first mean-color test was vacuous (see mutations).
7. `ink` color with `hatch` looked uniformly dense because hatch density is the only tone cue when marks are one ink; the guide no longer promises an engraving, and offers the monochrome flat print instead.

Known looks, not defects: `best` split makes thin horizontal strips in graded areas; rotated halftone lattices moiré at cell borders (ink dots at 4-unit pitch); at gutter 0 antialiasing shows faint seams.

## Measurements (Node 22, this machine; first-call numbers include JIT and bundled-image generation)

| Case | Time |
|---|---|
| default, cold (source + plan + draw into an SVG recorder) | 48–76 ms |
| default, warm draw | 3–6 ms |
| appearance edit (palette, filler, retention, seed) | 1.7–7 ms |
| structural: threshold 3 / 2 with minCell 4 and 256 px | 18–22 ms / 79–156 ms |
| 512 px portrait, minCell 3, threshold 1.5, flat (11.7k marks) | 245–345 ms cold; same plan hatched 11–16 ms |
| dense dots / border stitch / hatch spacing 2 (60k marks) | 34–79 ms |
| partition that exceeds 4,096 cells (256 px noise) | refused in 4–36 ms |

## Limits and open concerns

- No watercolor filler (flat cells at a lower body opacity stand in); no nested sub-mosaic filler beyond `motif`; detail is one scalar (no multi-channel color error).
- The bundled images are synthetic; user images need the host binding. The mapping stretches the crop by < 1 source pixel.
- Hatch/dot geometry is recomputed per draw (cheap: ≤ 80 ms for 60k marks); it is not cached.
- The orientation of a large flat gradient cell is a real direction of the gradient (large arrows in the arrow filler); low-coherence cells fall back to the angle offset alone.
- `docs/visual-review.json` is not updated (outside this branch's file list); root should register the images.

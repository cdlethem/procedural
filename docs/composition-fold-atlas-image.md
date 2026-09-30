# Fold Atlas Image (brief 27 completion)

Status: **implemented on branch `w5/fold-atlas-raster`, unreleased.** The shipped [Fold Atlas](composition-structural-operators.md#fold-atlas-briefs-2627-shape)
maps vertices and marks only. Brief 27 also asks for density accumulation and stretched image fragments, which needed the
[raster foundation](composition-raster-structure.md). This entry adds them as two new **consumers of the existing coordinate
maps** (`warp.ts`, unchanged apart from one exported helper, `warpMapper`), exposed as a new instrument, `fold-atlas-image`
("Fold Atlas Image"). The existing `fold-atlas` entry, its defaults and its drawings are untouched (fingerprints below).
Guide: `packages/instruments/guides/fold-atlas-image.md`. Code: `composition/fold-raster.ts` (the two computations),
`composition/fold-atlas-image-draw.ts` (descriptor, drawing, preparation), `adapters/fold-atlas-image-instrument.ts`
(controls). Tests: `tests/composition-fold-atlas-image.test.ts`.

## Two semantics that must not be confused

| | forward density (`foldSamples` → `foldMapped` → `foldDensity` → `tonemapDensity`) | inverse sampling (`foldPreimages` → `foldColors`) |
|---|---|---|
| loops over | source samples | output cells |
| many-to-one (a fold) | **counts add**: density is the sum over every sheet | **one sheet** is shown, chosen by the sheet rule; the others are hidden |
| one-to-many (a stretch) | cells between samples stay **holes**: 0, never filled, never interpolated | every cell whose preimage is in the picture is painted: no holes |
| singularity / bound | the sample is dropped and counted (`excluded`) — the `warpPoint` rule | the cell is excluded when no start converges to an in-domain preimage |
| what is drawn | tone-mapped counts as merged rectangles or dots | the source color as merged rectangles |

Test: a sinusoidal fold `sin(3u)` puts the source strip over each output x twice. In the cell at output `s = 0.775` the two
source points are `u = asin(s)/3 = 0.294` (red, positive Jacobian) and `u = (π − asin s)/3 = 0.752` (blue, negative). Density
there is the **sum** of both regions (the test recounts every one of 160,000 grid samples independently and matches all 1,600
cells exactly; per sheet `100 / (3 |cos 3u|) / 3`); inverse sampling shows **red** with `sheet: front`, **blue** with
`sheet: back`, and blue with `search: nearest` (Newton from the cell itself lands on the closer sheet).

## Forward density

- **Samples.** `foldSamples(raster, sourceRect, spec)`. `tone`: sample *i* picks a pixel by inverse CDF of its weight
  (`(1 − lightness)^curve` for dark, `lightness^curve` for light, lightness from `valueField`) and a uniform point inside it,
  from draws `foldUnit(seed, i, k)` that depend on the seed and *i* only, so the first N samples of a larger set **are** the
  N-sample set (tested; the sample-count mutation below fails it). An image with no such tone is an error naming the choices.
  `grid`: a `columns × rows` lattice with the source's aspect (about `count` cells), each point displaced within its own cell by
  up to `jitter`; the count follows the lattice, so it is not prefix stable. Every sample has unit mass.
- **Mapping.** `foldMapped` pushes each sample through `warpMapper` (the validated `warpPoint`): non-finite or beyond
  `bound × radius` is excluded, never clamped.
- **Accumulation.** `foldDensity(mapped, frame, cell)`: sample `(x, y)` falls in column `floor((x − frame.x)/cellWidth)`
  and row `floor((y − frame.y)/cellHeight)`, counted when both are inside the grid (so the right and bottom frame edges belong
  to no cell), otherwise counted as `outside`. Collisions add. **Conservation:** `total + excluded + outside = samples`
  always (tested against an independent binning of every sample, with an analytic count of the excluded ones for inversion).
  `holes` counts cells with no sample.
- **Exposure is a separate stage.** `tonemapDensity(density, exposure, curve)` reads the finished counts only:
  `x = exposure · count / reference`, where `reference = samples · cellArea / sourceArea` is what an unfolded uniform spread
  puts in a cell; `film` `1 − e^−x`, `log` `ln(1+x)/ln 9` capped at 1, `linear` `x/4` capped at 1; an empty cell is exactly 0.
  Exposure edits return the same `samples`, `mapped` and `density` objects (tested by identity), so no mapped sample can move.
- **Drawing.** `bands`: tone steps to merged rectangles (`mergeRuns`); `dots`: a circle per cell of area proportional to tone.
  Color is ink (first palette color tinted toward white by tone) or the palette read from its last (sparse) to first (dense).
  Everything is opaque where drawn and absent where the cell is empty; the layer is transparent.

## Inverse sampling

- **Method.** Damped Newton on `F(p) = c` (`c` the cell centre, `F` the chained maps): forward-difference Jacobian with step
  `1e-5` radius, residual tolerance `1e-6` radius, at most **24** iterations, each step halved up to five times until the
  residual falls. A step onto a point the maps exclude, a singular Jacobian (`|det| < 1e-9`) or an unimproved residual ends
  that start as not converged. The Jacobian determinant at the solution gives the sheet's orientation.
- **Exclusion rule (exact).** A cell is excluded (drawn as nothing; status `unconverged` if no start converged, `outside` if
  some converged outside the source rectangle) exactly when no start converges to a preimage inside the source rectangle.
  Nothing is interpolated or borrowed from a neighbour. Tested exactly on an inversion map (bound 2, source half-width 0.8):
  every cell not on a rule boundary is drawn or excluded as the closed form predicts, with the preimage matching `c/|c|²`.
- **Starts.** `search: "nearest"` uses one start, the cell itself. `search: "sheets"` first pushes a lattice of source points
  (spaced `cell / seeds`, 1–4 per cell side) forward, keeps per cell the seed nearest its centre for each orientation of the map
  there, and starts Newton from the cell centre and those seeds; only if that finds nothing does a cell also try the preimages of
  the cell to its left and above. Among the distinct in-domain preimages the **sheet rule** picks: front (positive determinant)
  or back first, then nearest the cell centre, then the first found. An earlier version started Newton from a fixed lattice
  over the picture: it missed sheets and cost ten times more (below), so it was replaced by forward-mapped seeds.
- **Sampling.** `foldColors` reads the picture with the stated filter (`nearest`, `bilinear`, `bicubic` from the raster
  foundation), edge rule **`clamp`** (a preimage lies inside the source rectangle, so it only shapes the outermost half pixel) and
  interpolation in **linear light**, encoded back to sRGB. Rasters must have no alpha channel (named error).
- **Area averaging** (`areaAverage`, on by default). Where the map shrinks the picture a one-point read aliases. A cell's
  footprint is `cellArea / |det|` canvas units²; the read is taken from box-averaged halvings of the picture (`resizeRaster`
  `box`, exact area means in linear light) at level `log2(footprint side in pixels)`, blended between the two nearest levels
  (rounded for `nearest`), capped at level 4 so cells hugging a fold line (`|det| → 0`) do not smear. Unshrunk cells read level 0,
  which is exactly the raster (tested). Off reads one point. Honest limit: the footprint is isotropic, so a strongly anisotropic
  shrink (one axis stretched, the other shrunk) is blurred along both axes.
- **Drawing.** Cells are stepped to `levels` per channel (or to a palette ramp of brightness) so equal neighbours merge:
  horizontal runs, then runs with the same column span and color in consecutive rows merge into one rectangle (`mergeRuns`
  tiles exactly the non-empty cells, tested by reconstruction). Fragments the map has turned over (negative determinant) are
  darkened by `backShade`. Each rectangle carries a 0.35-unit stroke of its own color so adjoining rectangles show no
  antialiasing hairline.

## Controls (`fold-atlas-image`)

Image (`image` validated select over the four bundled samples, `variant`, `resolution`); Placement (image centre and size, frame
size, both proportional pairs); Map (the Fold Atlas controls, same names and ranges); Show (`mode`, `cell`); Fragments
(`filter`, `areaAverage`, `search`, `seeds`, `sheet`, `backShade`, `levels`, `color`); Density (`sampling`, `count`, `weight`,
`curve`, `jitter`, `exposure`, `tonemap`, `display`, `bands`, `dotMax`, `densityColor`). `controlGroups` as above; every mode-,
search-, sampling- and display-specific control carries an inline `visibleWhen` (chained through `mode`), and a hidden control
never changes the drawing (tested with the drawing fingerprint helper in both directions). Slider ranges are separate from hard
limits (for example `cell` 4–24 in the slider, 1–400 exact; `seeds` 1–3, 1–4). The authored default is a handkerchief map
then a twist on the bundled portrait, in fragments mode: the face sits in sweeping folded arms with turned-over sheets darkened.
Structural seed variation exists only where chance belongs: density with tone sampling, or grid sampling with jitter above 0
(`foldAtlasImageUsesSeed`); fragments never use the seed.

## Bounds

At most 40,000 output cells per frame, 400,000 samples, 300,000 forward-mapped seed points; each failure names the control to
change (`Cell size`, `Search detail`, `Fold search`). `validate` checks the coupled bounds, so every slider corner is admitted.

## Evidence

Tests (`tests/composition-fold-atlas-image.test.ts`, 18) use independent expectations: identity at amount 0 (every cell reads its own pixel for all filters with and without area averaging, and one grid sample fills each cell); documented map values for mapped samples; density conservation with an independent binning and an analytic excluded count; the two-sheet fold (density sum versus front/back/nearest sheet); inverse round trips on fisheye, swirl, waves, spherical and a chain to 2e-3 units; the exact exclusion rule on an inversion map; area averaging of a one-pixel checkerboard; exposure independence and stage caching by object identity under palette, levels, shade, color, exposure, tone response and display edits; prefix-stable tone samples that follow the image; run merging by exact reconstruction; mirrored shading; hidden controls and seed use through the drawing fingerprint; named bounds; and every slider end (each numeric control alone at min and max, all-min, all-max, with the other controls at min or max, both modes) validating and drawing. No test asserts wall-clock time; the slider test asserts the declared work bounds (cells, seed points, samples) instead.

**Mutations confirmed to fail** (10 tried, 10 killed): collisions overwrite instead of add (density conservation and fold tests); sheet rule inverted (fold test); in-domain check dropped (fold and exclusion tests); tone sample draws depend on the count (prefix test); holes filled from the left neighbour (conservation and hole test); merged runs ignore the color key (run test); film tone response changed (exposure test); samples outside the frame clamped into the edge cell (conservation test); mirrored cells not shaded (shade test, added after this mutation first survived).

**Fold Atlas untouched.** `drawFingerprint` of `fold-atlas` (defaults and three variants: beads, spherical, polar with irregularity) at seeds 42, 7 and 2024: 12 hashes identical before and after (built from main, then from this branch).

**Timings** (Node 22, this machine under heavy shared load, first preparation with cold stage caches, default frame 620 x 620): fragments default 240 ms (cell 5, 3 seeds); an appearance edit (palette, levels, shade, color, filter aside) reuses the cached preimages and colors and redraws in about 2 ms; a color-filter edit re-reads the picture only; density default (100,000 tone samples) 35 ms, an exposure or display edit about 2 ms (tone map of the cached counts). Slider corners: fragments all-max 150 ms, density all-max 180 ms, all-min 6 and 3 ms; the costliest corners: fragments at the finest cell (4), 3 seeds and every other control at its maximum 1.3 s, the same with a four-times-repeated handkerchief, swirl, waves chain 1.5 s, density with 150,000 samples at cell 4 and the same chain 140 ms. Solver: a 56 x 56-cell fold region solves in about 130 ms with seeds, versus 750 to 1,800 ms for the earlier fixed-lattice starts that missed sheets. Timings are measurements, not guarantees.

**Review record.** Rendered through a throwaway SVG surface under the native lease: the default in both modes, all eight maps in fragments, two chained maps (handkerchief then swirl on the portrait, waves then horseshoe on the landscape), density in bands and dots with tone and grid sampling, and the Fold Atlas grid layered over fragments and over density in both orders. Defects found by looking and fixed: white gaps and wrong sheets on folds with a fixed lattice of Newton starts (replaced by forward-mapped seeds and neighbour fallback starts); a first default (swirl then sinusoidal) whose fine folds read as confetti (replaced by handkerchief then swirl; the confetti is documented as under-resolved folds); a density default that read as speckle at 60,000 samples (raised to 100,000); hairline seams between rectangles at reduced scale (stroke overlap of 0.35 units). Not fixed, by design: salt-and-pepper cells where a map folds finer than a cell; sampling noise in tone density at small cells.

## Non-goals and open concerns

- Only bundled images: a user's picture binds through a host asset field that does not exist yet (the descriptor accepts a
  resolved `Raster` through the direct API).
- Density's tone-sampled default is speckled by sampling noise at small cells (about 20 samples per cell at the defaults);
  raise the count, use grid sampling, or enlarge the cells.
- Where a map folds finer than a cell (waves at amount above 1, high-frequency sinusoidal), fragments show salt-and-pepper
  cells: they are honest preimage choices among many thin sheets, not interpolation. Smaller cells or milder maps resolve them.
- No anisotropic footprint filtering; no third view (density and fragments together): layer two instances.

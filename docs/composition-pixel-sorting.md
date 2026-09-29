# Pixel Sorting (brief 29)

Status: implemented on branch `w2/pixel-sorting`, unreleased; rendered-output reviewed with a throwaway SVG
surface, not root-reviewed through the real interface. Built on the merged
[raster and image-structure foundation](composition-raster-structure.md) and the frozen
[reference slice](composition-reference-slice.md) / [structural operators](composition-structural-operators.md)
conventions. No new raster, sampling, segmentation, orientation or sorting implementation was written; the
sort is `scanRuns` + `sortScanRuns` + `applyPixelMoves` from `image-structure.ts`, the region masks use
`segmentValueBands` and `orientationField`, and the run outlines are drawn by the existing `pathMaterial`.

## Artist-facing brief

Ordered streaks selectively dissolve an image while chosen structure stays exact. The artist chooses the scan
direction (eight straight ones), which stretches are sorted (a value interval of brightness, lightness, hue or
saturation, plus shortest and longest run and an optional seeded ragged field), how they are ordered (sort
key, ascending or descending) and what is protected: an ellipse, the connected tone region under a point, the
strongest edges or seeded noise blobs (or the inverse: sort only inside the region). The result is drawn as
merged vector bars or stitch-like strokes, everything or only the sorted streaks (so an unsorted copy can sit
underneath), in the image's colors or as a palette gradient of brightness, with optional run outlines from a
path material. Four synthetic sample images ship; the default is a portrait whose head is protected while the
dark tones of the collar and background become streaks.

## Frozen input contract

The library never fetches or decodes. The recipe's `image` is `{ kind: "bundled", id, size, variant }` (plain
JSON: the instrument stores only its technique id, scalar parameters and palette, so it can only name a bundled
sample) or `{ kind: "raster", raster }` for a `Raster` the caller constructed (identified by its content
`hash`; it does not round-trip through JSON). Binding a host-owned image to a Studio layer is future host work.
The instrument fixes the bundled variant (seed 3 of each sample) so the subject does not change with the
seed; `variant` is a recipe field, not a control.

## Frozen boundary and semantics

Files: `composition/pixel-sorting.ts` (producers, drawing, preparation, binding),
`adapters/pixel-sorting-instrument.ts` (definition), `guides/pixel-sorting.md`,
`tests/composition-pixel-sorting.test.ts`.

- **Selection.** Each pixel has a selection value: the chosen `ValueKind` (`luma`, `lightness`, `hue`,
  `saturation`), moved by the ragged field when there is one and clamped to [0, 1] (so a full-range interval
  cannot be moved out of by chance). A pixel is selectable when its value lies in `[from, to]` inclusive,
  its alpha is above 0, and it is outside a protecting region or inside a selecting one. This is passed to
  `scanRuns` as a `ScalarGrid` value grid and an eligibility mask, so run maximality, `minRun` and the eight
  direction line rules are the foundation's.
- **Longest run.** `maxRun` cuts every run longer than the cap into `ceil(L / maxRun)` pieces whose lengths
  differ by at most one, longer pieces first, in scan order. Pieces are never shorter than
  `floor((maxRun + 1) / 2)` and may be shorter than `minRun` (which applies to whole selected stretches).
  Pieces are contiguous, so no pixel is lost or unselected by the cut.
- **Sort.** Stable, ties in scan order in both orders; pixels move only inside their run, so protected and
  unselected pixels and alpha are byte identical and the pixels of a run are conserved (tests compare
  per-run multisets and replay the mapping).
- **Regions** (`pixelSortMask`, a 0/1 grid; 1 = in the region). `ellipse`: pixel centres inside the closed
  ellipse (a centre exactly on the boundary is inside). `region`: the 4-connected component of one equal-width
  lightness band (`bands`, small regions under 0.4% of the image merged) holding the pixel under the focus point,
  empty when that pixel is fully transparent; `grow` dilates by a Chebyshev radius (`dilateMask`, exported).
  `edges`: the `share` of pixels with the largest gradient energy (`orientationField`, smoothing 1 pixel;
  energy at or below 1e-10 is never marked, so flat images have no edges), then `grow`; ties fill in raster
  order so exactly `round(share * pixels)` pixels are marked when enough have energy. `field`: gradient noise
  (`gradientNoise2D01`, blob `scale` in pixels, seed from `componentSeed(seed, "pixel-sorting", "field")`)
  thresholded by rank to exactly `round(share * pixels)` pixels.
- **Outputs.** `pixelSortStructure(construction)` returns the frozen `PixelSortStructure`: `source`, `mask`,
  `runs` (the foundation `RunSet`), `moves` (`PixelMoves`: destination and source pixel index per slot),
  `sorted` (the transformed raster) and `moved`. `pixelSortRunTable(structure, key)` is the run table (id,
  index, line, position, length, key range, pixels moved); `movedPixels` lists the pairs that change place;
  `pixelSortRunAt` answers which run holds a pixel. Ids: runs `run:<x>.<y>`, streaks `s:<x>.<y>` of the first
  pixel in scan order.
- **Streaks.** `pixelSortStreaks(structure, { show, tint, merge, palette })` merges each scan line into
  streaks: a streak ends at a run change, where a sorted color leaves the tolerance (maximum channel
  difference from the streak's running mean, inclusive), or where an unsorted color differs at all, so
  unsorted pixels are drawn exactly. `tint: "palette"` first replaces each pixel's color by the palette
  gradient at its luma (alpha kept). Streaks partition the image exactly once in every direction (tested).
  Bars are one rectangle, or for a diagonal one polygon: the exact staircase union of the pixel squares
  (`runOutline`). Stitches are round-capped strokes along the scan line with a stated gap.
- **Consumers.** `drawPixelSorting(surface, recipe, { streak, outline })`. The stock streaks are drawn in one
  push/pop batch (vectorized: no per-mark isolation, no graphics buffer per pixel or streak). A `streak`
  callback gets each streak as a `StreakSite` through `atEach` (canvas centre, scan angle, canvas length and
  breadth, seed `componentSeed(seed, id, "streak")`, tone 1 sorted / 0 unsorted) and is charged to the run
  budget. `outline` replaces the path material that draws `pixelSortRunPaths` (closed paths, tone 0).
- **Cache.** `pixelSortStructure` is cached (LRU 6) by image identity, direction, selection, lengths, sort,
  region and role, and the seed only when the ragged field or the noise region is used. Palette, color mode,
  merge tolerance, mark kind, outlines and footprint never rebuild it or rename a run. The streaks are cheap
  (0.9-6.5 ms measured) and rebuilt for each drawing.
- **Seeds.** The sort is deterministic. Chance enters only through the ragged field and the noise region.
  `pixelSortingUsesSeed` states this and is tested against real drawing changes (it is false for a full-range
  interval, a zero amount, and a noise share of 0 or 1).
- **Bounds** (explicit, never truncated; messages name the control): foundation bounds of 4,194,304 pixels
  and 1,000,000 runs; at most 40,000 streaks (`Merge tolerance` or `Resolution`); at most 4,000 outlined runs
  (`Shortest run`, the interval, or set `Run outlines` to None); stitched outlines are checked against a
  2,000,000-unit callback budget (per path: one callback, its vertices, two units per station) before anything is
  painted (`Outline stitch spacing`, `Shortest run`, or ink). A drawing's default budget is that 2,000,000
  (`PIXEL_SORTING_LIMITS.work`), found necessary when the shared property test drew stitched diagonal outlines
  of a noise image and overran the default 100,000. `Resolution` slider 48-192 (at most 36,864
  pixels, so never over the streak bound), hard 16-256 (a noise image at 256 with tolerance 0 does exceed it).
- **Not offered.** Curved scan paths (they would need their own pixel visitation and overlap rules, so only the
  foundation's straight lines are used); a union of two intervals; per-line thresholds.

## Controls (groups, dependencies)

Groups: Image (image, resolution); Placement (center, proportional Size); Runs (direction, Selection, Length,
Ragged edges); Sort (key, order); Protected region (region, role, Focus, proportional Ellipse, bands, share,
blob size, grow); Streaks (draw, color, mark, merge tolerance, Stitch); Run outlines.
Proportional: `width`/`height` (canvas units); `focusWidth`/`focusHeight` (both fractions of the image). Not
proportional: stitch thickness and gap (different units), the interval (a range, not a size).

Inline `visibleWhen`: `maskRole` for any region; `focusX/Y` for ellipse and connected region; `focusWidth/Height`
for the ellipse; `bands` for the connected region; `share` for edges and noise; `fieldScale` for noise; `grow`
for connected region and edges; `maxRun` when the cap is on; `scatter`/`scatterScale` when ragged; `merge` unless
only unsorted pixels are drawn; `stitchWidth`/`stitchGap` for stitches; `lineWeight` for any outline and
`lineSpacing` for stitch outlines. A property test (40 seeded configurations over every combination of the
select and toggle drivers, every hidden control changed) shows no drawing change. Controls that are irrelevant
under a numeric value (for example the ragged amount 0) cannot be expressed as a condition and stay visible.
The control audit (`tests/helpers/audit-controls.ts pixel-sorting`, 37 controls, 2,279 probes) reports 0 violations,
0 dead controls and 0 remaining proposals; four controls stay visible because their relevance is a disjunction of
selections (not a single condition).
Slider intervals are conveniences; hard limits: resolution 16-256, interval start 0-1, width .005-1, shortest run
1-1000, longest run 2-1000, ragged amount 0-1, scale 1-500, ellipse size .01-4, tone bands 2-64, share 0-1,
blob size 1-1000, grow 0-16, merge tolerance 0-1, stitch thickness .05-2, gap 0-.95, footprint up to 8192.

## Verification

`tests/composition-pixel-sorting.test.ts` (29): exact hand-worked rows, diagonals and interval boundaries;
stable ties (saturation of pure colors), hue order; alpha; an independent line-wise oracle over 60 random
images, directions, intervals, masks and orders; per-run multiset conservation, unselected bytes, mapping
replay and `movedPixels`; longest-run pieces (fixed example, left direction, and a sweep of every cap and
length); analytic ellipse (boundary centres), the connected-region example incl. 4-connectivity and grow,
edge share on a step image and flat images, exact noise share, dilation; ragged chance (seed dependence, full
interval immunity, exact interval membership); `usesSeed` against drawing; cache identity (appearance edits,
structural edits, seeds) and stable run ids; frozen values and JSON replay; streak partition in every
direction, merge rules (running mean, inclusive tolerance, unsorted exactness, run boundaries), palette
gradient values; outline polygons as exact pixel unions (area, inside/outside for every pixel) in every
direction; canvas mapping; work bounds; preparation and cancellation; transparency and footprint; consumer
substitution; the hidden-control property test; controls' groups and dependencies.
**Twelve mutations were confirmed to fail** (12 of 12 killed): ellipse boundary `<=` to `<`; cap pieces'
extra length placed last; region role inverted; merge tolerance inclusive to exclusive; unsorted pixels merged
with the tolerance; staircase return chain reordered; ragged clamp removed; noise/edge tie fill removed;
uneven cap pieces; descending ignored; alpha not excluded; seed removed from the cache key.

## Review record

Rendered with a throwaway SVG surface (Chromium): defaults on all four images and three seeds, sixteen
strongly different structural settings (horizontal, diagonal, hue selection, run cap, edge/region/noise/select
roles, stitches, sorted-only with ink outlines, sparse, dense at 192 px, combined), and layered compositions
with the unmodified Contour Scores and Motif Ecologies and with an unsorted copy of itself, in both orders.
Defects found and fixed while looking: the first default (bright interval, descending) barely changed the
portrait, so the interval, order and protected ellipse were reworked; the ellipse cut across the hair and left
a sorted cap on the head, so it was enlarged; the default is ragged so a seed reroll changes the structure;
outline and stitch claims in the guide were overstated and were corrected against renders (landscape and
geometry examples replaced by verified settings). Known limits found by looking, not fixed: the Geometric
scene does not change under the default (flat blocks only sort where a run holds several colors, so it needs a
wide interval, see the guide); stitches turn the protected region into thread-like marks too (its colors stay
exact, its shapes do not), so exactness is best read in bar mode; when an opaque pixel-sorting layer covers
another, antialiasing leaves a faint dotted residue of the lower layer at pixel edges; a palette gradient of
a low-contrast image (the noise image sorted by hue) is nearly flat.

Measured on this machine (Node 22, bundled 128 px portrait): first draw of the default 37 ms including image
generation; palette-color or stitch edit 4 ms; direction change (structural) 7 ms; 192 px noise 23 ms;
256 px noise with tolerance .2 27 ms; run outlines at the default (245 runs) ink 21 ms, stitches 153 ms, and the
worst default-numeric case, stitched diagonal outlines of the noise image at shortest run 2 (864k callbacks),
423 ms; streaks 0.1-6.5 ms.
A whole 192 px image is about 37k marks at tolerance 0 (18 ms to record).
Open: real-interface exploration and layering in Studio, whether hosts should bind user images and offer a
curved path only with explicit visitation rules, and that the sort key and selection value are limited to the
four foundation value kinds (a custom key needs a `ScalarGrid` API control, not offered).

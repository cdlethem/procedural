# Raster inputs and image structure (F3 raster + the image-structure cluster)

Status: **implemented on branch `w2/raster-structure`, unreleased. Enabling code only: no instrument,
no metadata entry, no Studio control.** It serves briefs 29 (masked pixel sorting), 30 (adaptive
image compartments), 31 (connected value regions), 32 (painterly source interpretation), 33
(frequency-modulated engraving), 34 (slit compositions), 35 (image-directed field drawing), and the
raster half of 09/11/12 (pigment, sand and height fields). It follows the frozen conventions of the
[reference slice](composition-reference-slice.md) and [structural operators](composition-structural-operators.md)
(deeply frozen values, explicit failure naming the control to change, explicit work bounds, no
truncation, canvas units, angles in radians for published values).

Files: `src/composition/raster.ts` (value, sampling, conversion, extraction), `image-structure.ts`
(the five operations), `raster-samples.ts` (bundled images); `tests/composition-raster.test.ts` (18
tests), `tests/composition-image-structure.test.ts` (35 tests). Exports are added to `src/index.ts`
with collision-safe names (`subdivideImage`, `valueRegionMask`, `applyPixelMoves`, `sortScanRuns`, ...).

## Input contract: the library never fetches or decodes

`createRaster(RasterData)` receives **resolved samples plus every declaration**; a host (or
`bundledRaster`) decodes files, URLs and containers. Nothing here opens, fetches or decodes anything.
It validates, **copies** and freezes: mutating the source array later cannot change the raster, and
`rasterData` returns a copy. Typed-array storage cannot be frozen, so it is private to the module
(WeakMap); a `Raster` has read accessors only (`rasterPixel`, `rasterData`, `sampleRaster`,
`valueField`). The same holds for `ScalarGrid` and `LabelGrid`, the immutable float64/int32 results
of analysis.

| Declaration | Values | Notes |
|---|---|---|
| `width`, `height` | integers 1..8192, at most 16,777,216 pixels, 128 MiB of storage | checked before any allocation; message names width/height/channels/format |
| `channels` | 1 gray, 2 gray+alpha, 3 RGB, 4 RGBA | alpha is always the last channel |
| `format` | `u8` (integers 0..255, value = byte/255) or `f32` (finite, **[0, 1]**) | no unbounded float fields: a host normalizes heights/pigment (open concern 1) |
| `colorSpace` | `srgb` (IEC 61966-2-1 curve) or `linear`; Rec. 709 primaries | describes color channels only; **alpha is always linear coverage** |
| `alpha` | `none` (channels 1, 3), `straight`, `premultiplied` (channels 2, 4) | all declared, no defaults; premultiplied requires color <= alpha (u8 exact, f32 within 1e-6) |
| `label` | optional diagnostic name | in messages, **not** hashed |

Pixel-center convention: raster space has its origin at the **top-left corner** of the top-left pixel,
x right, y down, one unit per pixel; pixel (i, j) covers [i, i+1) x [j, j+1) and is sampled at its
centre (i+0.5, j+0.5). A point exactly on a boundary belongs to the larger index (`nearest` uses
`floor`). `rasterMapping(size, rect)` places this space on a canvas rectangle (independent x and y
scales allowed; `toRaster`/`toCanvas`). `cropRaster` copies an exact integer rectangle;
`resizeRaster` (`box` = exact area average, or nearest/bilinear/bicubic sampled at destination pixel
centres, which alias when shrinking more than about 2x) works in premultiplied **linear** light and
returns the source's own space, alpha mode and format.

**Content hash.** `raster.hash` is the lowercase hex SHA-256 of
`"procedural-raster/1\n" + w + "x" + h + "x" + channels + " " + format + " " + colorSpace + " " + alpha + "\n"`
followed by the storage bytes (`u8` as is, `f32` little-endian), computed lazily in pure JavaScript
and cached (59 ms for a 2048 x 2048 RGBA byte raster). Tests recompute it with `node:crypto`. Use it
as the asset identity in exported documents and as a cache key.

## Sampling

`sampleRaster(raster, x, y, {filter, edge, space, output})` reads the raster at any real point.

- Filters: `nearest`, `bilinear` (default), `bicubic` (Catmull-Rom, a = -1/2). Bicubic may overshoot;
  the result is clamped to [0, 1] and color to <= alpha. Tests: exact at pixel centres for every
  filter, exact for linear ramps, the -1/16 tap weight clamps to 0.
- Edge rules: `clamp` (default), `repeat`, `mirror` (reflects about pixel **edges**), `zero`
  (transparent black; for an alpha-free raster, black, so the image fades to nothing at its border).
- **Interpolation is on premultiplied color in the working space** (`space`, default the raster's own;
  a different space converts each texel first). A transparent pixel's hidden color never bleeds:
  opaque red beside transparent blue samples as half-covered red, not purple. The result is returned
  straight (default) or premultiplied; colorless coverage of 0 returns color 0.
- `sampleInto` writes into a caller array for hot loops (1M bilinear samples: 280 ms; bicubic 920 ms).
- `sampleGrid(grid, x, y, edge)` is the same bilinear read for a `ScalarGrid`.

## Boundary conversions

`convertRaster(raster, {colorSpace, alpha, format})` is the only place representation changes. Float
to byte rounds to nearest, .5 upward; converting to bytes or premultiplying bytes loses precision, and
premultiplying a straight byte raster discards the hidden color of transparent pixels. Requesting an
alpha mode for a raster without alpha throws.

## Value extraction

`valueField(raster, kind, {background})` returns a `ScalarGrid` in [0, 1]. Transparent pixels are
composited over `background` (a **linear** gray level, default 1 = white paper) in linear light.

| kind | definition |
|---|---|
| `luminance` | Y = 0.2126 R + 0.7152 G + 0.0722 B on linear light |
| `lightness` | CIE L* / 100 of that Y (equal steps look equal; the default for structure operations) |
| `luma` | the same weights on **sRGB-encoded** values (the display gray sorters use); an opaque neutral pixel gives exactly its own value |
| `hue`, `saturation` | HSV of the encoded composited color; hue in [0, 1), achromatic 0 |
| `alpha` | coverage (1 without an alpha channel) |

## Bundled sample rasters

`bundledRaster(id, seed, size = 128)`: square 8-bit sRGB RGB (no alpha), 16..512 pixels, cached,
label `<id>:<seed>`. Generated from seeded closed-form code (ellipses, half-planes, smoothsteps,
hashed value noise) using only IEEE arithmetic, `Math.sqrt`, `Math.floor` and integer hashing, so the
bytes and the hash are **identical on every JavaScript engine** (pinned in the tests). 128 px costs
3-12 ms, 512 px 6-56 ms. Nothing is a photograph.

| id | subject | measured character (96 px, seed 3) |
|---|---|---|
| `portrait` | feathered head and shoulders on a graded backdrop | 12.7% flat pixels, 16 regions (4 bands, 8-connected) |
| `geometry` | Mondrian grid, disc, triangle, stripes (five normals), checker patch | 70% exactly flat, 35 regions |
| `landscape` | sky gradient, sun, clouds, three noisy ridges, textured ground | 0.4% flat, 64 regions, sky brighter than ground |
| `noise` | low-frequency color field, detail, film grain, vignette | 0% flat, 137 regions (worst case for segmentation) |

## Image structure operations

Common rules: sources are a `Raster` (with a `value` kind and `background`) or a `ScalarGrid` (used as
is); at most **4,194,304 pixels** (2048 x 2048) per analysis, checked before any pixel is read; results
are frozen; nothing consults a clock or random source, so every result is a pure function of content
and options.

### Segmentation: `segmentValueBands(source, options)`

- **Bands.** `bands` (2..256 equal widths) or strictly increasing `thresholds`. A value **equal to a
  threshold is in the upper band**; 1 is in the last band.
- **Connectivity is required**: 4 (edges) or 8 (edges and corners) among equal-band pixels. Diagonal
  contact joins under 8 and not under 4 (a checkerboard is one region per pixel under 4, two under 8).
  Different-band regions never join. Holes are just other regions; nothing is joined "through" them.
- **Ids** are `0..n-1` in raster order of each region's first pixel. Excluded pixels (mask < 0.5, or
  alpha <= `minAlpha`, default 0: only fully transparent pixels) have label **-1**.
- **Attributes** are exact: `area`, `mean` of the source value, `bbox` (half-open), `centroid` of pixel
  centres, `band`. `adjacency` lists region pairs (a < b) with the number of shared unit pixel edges
  (4-adjacent pairs, under either connectivity).
- **Merging** (`minArea` > 1). Smallest area first (ties: smaller id) each undersized region merges
  into a 4-adjacent neighbour chosen by `longest-border` (default; ties: nearest mean, then smaller id)
  or `nearest-value` (ties: longest border, then smaller id). Areas grow as regions absorb others, so
  merging cascades; a merged region keeps the band and identity of the region that absorbed it, and
  ids are recomputed compactly. A region with no neighbour (isolated by excluded pixels) stays and is
  counted in `undersized`. With no mask every region reaches `minArea` unless the whole image is smaller.
- **Output is labels, not polygons.** `valueRegionMask(seg, id)` gives a 0/1 `ScalarGrid`. The
  planar-domains foundation turns masks or unit pixel edges into polygons with holes; this module does
  not depend on it. Consumers tracing boundaries must use the same connectivity for the region and its
  complement's pinch points (8-connected regions are the natural pair of 4-connected holes).
- **Bounds.** 1,000,000 regions before merging (message: use fewer bands or a smoother/smaller source),
  250,000 after (message: raise `minArea` or use fewer bands).

### Adaptive subdivision: `subdivideImage(source, options)`

- Split while `metric > threshold` (metrics: `variance`, `stddev`, `range`, `sse` = area x variance;
  variance from float64 summed-area tables offset by the first pixel, so constant regions give exactly
  0), or while a side exceeds `maxCell`; never below `minCell` per side (a cell splits along an axis only
  if that side is >= 2 x `minCell`); never past `maxCells` leaves (default 4096, hard 250,000; **throws,
  never truncates**: raise threshold, raise minCell or raise maxCells). `maxCell` must be >= 2 x minCell - 1.
- Halves are `floor(n/2)` and the rest, so non-square and odd images tile exactly.
- Policies: `quad` (both axes when both can split, else the one that can), `longest` (the longer side;
  ties split x), `best` (the axis minimising the children's summed SSE regardless of metric; ties x).
- **Ids are paths** (`r`, `r.0`, `r.0.3`; quad 0 TL 1 TR 2 BL 3 BR, binary 0/1), so raising the threshold
  only prunes: every coarser node exists with the same rectangle at the finer threshold (property
  test over random images, all policies and metrics). Cell attributes: rectangle, mean value, error,
  split kind, children. `nodes` (parents first) and `leaves` (a Z-order tiling); `subdivisionLabels`
  paints leaf indices.

### Orientation: `orientationField(source, {smoothing, flatEnergy, fallback})`

- Gradient: 3x3 Scharr (exact for linear ramps; edge pixels replicate). Structure tensor smoothed by a
  Gaussian of `smoothing` pixels (required, 0..64, radius ceil(3 sigma), renormalised over the in-image
  part so uniform tensors stay uniform to the border).
- Angles: radians from +x toward +y (y down, clockwise on screen), **unsigned, in [0, pi)**.
  `direction` is the tangent of the level lines (along stripes/edges: a ramp increasing along +x has
  direction pi/2); `gradientDirection` is across them. `coherence = (l1 - l2)/(l1 + l2)`, `energy = l1 + l2`
  (mean squared gradient in value^2/pixel^2).
- **Flat areas have a stated fallback:** `energy <= flatEnergy` (default 1e-10) or an exactly isotropic
  tensor gives `direction = fallback` (default 0), coherence 0, `defined: false`. A constant image has
  zero energy and coherence everywhere.
- `orientationAt(field, x, y)` **interpolates the tensor bilinearly, then decomposes**: perpendicular
  equal-energy neighbours average to coherence 0 (no invented 45 degree line), and directions 0.05 and
  pi - 0.05 average to horizontal, not pi/2. At a pixel centre it equals `orientationPixel`.
  `orientationVector(sample, {across, hint})` returns a unit vector whose sign follows the previous step
  (dot >= 0; an exactly perpendicular hint keeps the default sign), so trajectory integration never
  flips at the wrap.
- Work: pixels x (6 x (2 ceil(3 sigma) + 1) + 30) <= 1,000 million (about 1.5 s), checked **before** any
  pixel is read; the message names `smoothing`.
- Scharr's angular error at a 16 px period is under 0.03 rad for oblique stripes (axis-aligned and 45
  degree stripes are exact to 1e-9); the tests state those tolerances.

### Scan runs and stable sorting: `scanRuns`, `sortScanRuns`, `applyPixelMoves`, `pixelSort`

- Eight straight directions (`right`, `left`, `down`, `up`, and the four diagonals). A scan line starts
  at each pixel whose predecessor is off the image; lines are ordered by start pixel in raster order;
  every pixel is on exactly one line. Curved paths are out of scope (their visitation and overlap
  semantics would be a new decision).
- A pixel is selected when the mask is >= 0.5, alpha > `minAlpha` and its value is in **[min, max]
  inclusive**. A run is a maximal consecutive selected stretch of at least `minRun`. Runs are
  `(x, y, length, line)`; `scanRunPixel` and `scanRunSegment` address them.
- **Stable sort.** Keys come from a `ValueKind` of the raster or a `ScalarGrid`; ties keep scan order in
  both orders and every direction. `sortScanRuns` returns the permutation (`PixelMoves`: slot to/from
  pixel indices); `applyPixelMoves` writes it: pixels move only inside their run, so unselected pixels
  are byte-identical, and pixels are conserved (tests compare per-run multisets). `alpha: "move"` moves
  whole pixels; `"stay"` moves color and each slot keeps its own alpha (premultiplied storage is
  rescaled so color <= alpha stays true). Reproducible exactly: the same input gives the same hash.
- Bound: 1,000,000 runs (message: raise `minRun` or narrow `min`, `max` or the mask).

### Phase-preserving frequency modulation: `frequencyModulation`, `modulatedPolyline`

- Along `s in [0, length]`, tones tau in [0, 1] at evenly spaced stations (array, or function of s with
  `samples`), raised to `curve`, give a piecewise-linear frequency `f` (cycles per unit, `frequency.min`
  at tone 0, `.max` at tone 1) and amplitude `A`. Phase is the exact integral
  `phi(s) = phi0 + 2 pi \int f`, quadratic inside each interval, so **the line never jumps where the
  frequency changes**; `offset = A(s) sin phi(s)`. The result carries `s`, `phase`, `offset`,
  `frequency`, `amplitude`, `endPhase` (pass it as `phase` to continue on the next line) and the actual
  `largestPhaseStep`.
- **Sampling limit.** Every vertex advances the phase by at most `maxPhaseStep` (default pi/8, hard
  maximum pi/2, so at least four vertices per cycle and no self-aliasing). Tone 0 with `amplitude.min = 0`
  is a straight line whose phase still advances, so a later dark area continues the same wave.
- Vertex bound 1,000,000 (message: lower `frequency.max`, raise `maxPhaseStep` or shorten `length`).
- `modulatedPolyline(line, {x, y, angle})` places it on a straight carrier; positive offset is to the
  right of the direction of travel on screen (the same rule as gesture normals).

## Evidence

Tests use analytic images: linear ramps at nine angles (exact tangent, energy = slope^2), sinusoidal
stripes at six angles, crossed stripes, checkerboards under 4/8 connectivity, ring/hole, corner contact,
an L-shaped region with hand-computed area/bbox/centroid, step edges (4, 10 and 22 leaves at minCell 1/4),
constant images (one region, one cell, zero coherence), exact FM phase against the closed form, and
SHA-256 against `node:crypto`. Properties (seeded random inputs): segmentation labels equal an independent
flood fill and every region is connected, areas sum to the image, adjacency equals a direct edge count;
subdivision trees are nested across thresholds and tile exactly; runs partition and are maximal in all
eight directions; sorted runs are ordered, conserve pixels and leave unselected pixels untouched;
sampling stays in range for every filter/edge/channel layout.

**Mutations confirmed to fail** (20 tried; 17 killed by the first suite, two more after adding a tie case and an exact-0.5 mask case):
band tie `<=` to `<`; merge longest border to shortest; 8-connectivity ignored; tangent without the
+pi/2; coherence halved; subdivision `>` to `>=`; descending sort reversing ties; rectangle-rule FM
phase; straight color not weighted by alpha; mirror off by one; nearest rounding instead of floor;
`minRun` off by one; hash header changed; luma weights swapped; `stay` alpha taken from the source;
box resize in sRGB; hint sign ignored; mask `>= 0.5` to `> 0.5`; best-split tie to y. One equivalent
mutant (removing the `r >= pi` guard in the half-turn wrap, unreachable except through rounding)
survives by design.

## Measurements (Node 22, this machine; noise = worst case, landscape = photographic)

| Operation | 512 x 512 | 1024 x 1024 | 2048 x 2048 |
|---|---|---|---|
| `createRaster` RGBA u8 / first `hash` | 0.2 / 6.8 ms | 0.3 / 14.8 ms | 1.4-2.9 / 59 ms |
| `valueField` lightness | 18 ms | 50 ms | 201 ms |
| segment landscape, 8 bands, 8-conn | 92 ms (384 regions) | | |
| segment noise, 8 bands, 8-conn (119k regions) | 162 ms | throws at 250k regions | throws at 1M regions before merging (0.85 s) |
| segment noise, 4 bands, 4-conn, `minArea` 64 | 211 ms (1,872 regions) | 693 ms (7,583 regions) | throws before merging |
| subdivide landscape SSE 0.02, `minCell` 2 (7.3k leaves) | 44 ms | | |
| subdivide noise (16k-65k leaves) | 63-74 ms | 225-270 ms (65k leaves; 250k cap reached at 0.01 variance) | throws at 250k cells in 0.8 s |
| orientation sigma 0 / 4 / 8 | 30 / 80 / 103 ms | 104 / 269 / 416 ms | 418 ms / 1.14 s / over bound |
| `orientationAt` x 100k | 16 ms | 17 ms | 16 ms |
| `scanRuns` (lightness 0.2-0.8 on noise) | 52 ms (42k runs) | 203 ms (168k runs) | 777 ms (669k runs) |
| `pixelSort` selected runs / full rows | 75 / 80 ms | 276 / 323 ms | 1.08 / 1.35 s |
| `convertRaster` to linear f32 premultiplied | 45 ms | 168 ms | 675 ms |
| `resizeRaster` to half: box / bicubic | 66 / 189 ms | 240 / 727 ms | 970 ms / 2.95 s |

Frequency modulation: a typical 200-unit line with 400 tones and 0.05-1 cycle/unit is 2,163 vertices in
0.7 ms; 100,000 tones producing 457k vertices take 78 ms. Bundled images: 3-12 ms at 128 px, 6-56 ms at
512 px. A 1000 x 1000 checkerboard (one million 4-connected regions) merges to one region with
`minArea` 4 in 353 ms; a 1024 x 1024 checkerboard exceeds the pre-merge bound (tested).

Bounds chosen and why: **4,194,304 analysis pixels** keeps every operation near or below a second
(the slowest real cases are 2048 x 2048 orientation with sigma 4 at 1.1 s and sorting at 1.4 s);
the 1M/250k region bounds and 250k cell bound keep result objects to about 100 MB and reject
noise that no downstream mark treatment can use; the orientation work bound of 1,000 million
operations is about 1.5 s; the 1M run and vertex bounds keep result arrays near 100 MB. These are
measured guards, not certified slider ranges: root should freeze intervals separately.

## Non-goals and limits

- No decoding, fetching, URL or file handling; no camera or video; no embedded ICC profiles (a host
  converts to sRGB or linear Rec. 709 before `createRaster`).
- No unbounded float fields (f32 is [0, 1]); no HDR, no per-pixel high-precision alpha beyond f32.
- No polygon tracing, simplification or holes (planar-domains foundation); segmentation returns labels,
  masks, attributes and adjacency only. No clustering or k-means (the brief's alternative): bands are
  value quantization of one chosen scalar; a multi-channel clustering would be a separate producer that
  yields a `LabelGrid`-like input.
- No curved scan paths; no live quadtree budgeting (split-worst-first up to N cells); only the
  threshold rule, throwing at `maxCells`.
- `nearest`/`bilinear`/`bicubic` are the only filters (no Lanczos); resize `bicubic` does not
  prefilter.
- Not a JavaScript sandbox: callbacks passed to `frequencyModulation({tones: fn})` are trusted code.

## Open concerns and decisions to confirm

1. `f32` rasters are [0, 1]. Briefs 09/12 fields (height, pigment) that want other ranges must
   normalize; add range metadata only if a real consumer needs it.
2. `lightness` is the default value for bands and subdivision; `luma` is the pixel-sorting convention.
   Both are documented; consumers should pick deliberately.
3. Segmentation returns labels. Brief 31's "vector boundaries with holes" needs the planar-domains
   foundation to trace `valueRegionMask` or the label grid; the ids and adjacency here are the stable
   inputs to that step.
4. Hashing is pure JavaScript (about 270 MB/s). A host with WebCrypto may prefer to hash bytes itself;
   the canonical byte layout is documented so both agree.
5. Bundled images are synthetic. Whether to ship one genuinely owned photograph is a content decision.
6. The measured bounds come from one machine. `bicubic` resize costs about 2.8 microseconds per output pixel
   (RGBA), roughly 3x `box`, which matters only for very large sources.

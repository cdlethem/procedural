# Region Stitch (brief 13)

Status: **implemented on branch `w2/region-stitch`, unreleased. Reviewed from rendered output only (throwaway SVG surface
rasterised in Chromium); not yet exercised through the real Studio interface, layered in the app, or reviewed for responsiveness
there.** It is built on the merged [planar domains](composition-domains.md) and [raster / image-structure](composition-raster-structure.md)
foundations and follows the frozen [reference slice](composition-reference-slice.md) conventions. Guide:
`packages/instruments/guides/region-stitch.md`. It is **not a machine-embroidery export**: no pull compensation, thread-density units,
trims, colour changes, jump/stop commands or file format are modelled; every number is canvas geometry.

## Artist-facing brief

Embroidery-like regions: directional fill, seams and intentional thread crossings. This differs from dashes on an existing path (the
stitches are cut and routed per region) and from a woven grid (rows follow a field and change per region). What the toolkit removes:
the row geometry inside regions with holes, the stitch cutting under a stated length bound, the routing of rows into threads without
bridging holes or gaps, and the underlay/outline/seam bookkeeping.

## Input contract

A saved instrument persists only the technique id, scalar params and a palette. The typed API takes resolved values and never
fetches or decodes: `StitchRegion`s (any `PlanarDomain` through `stitchRegionsOf`, including `textDomain`, `maskDomain`/`labelDomains`,
Booleans and offsets) and a `StitchFieldSpec` (an image field takes a bundled sample or a caller-resolved `Raster`). The instrument
ships BUNDLED deterministic regions chosen by validated selects: the licensed font's `STITCH`, `THREAD`, `LOOP`, `QUILT`; a lobed blob
with a hole and two islands; a Region Quilt partition (with joined patches and windows); the tone bands of the bundled pictures.
**Binding a user's silhouette, glyph outlines or picture to a saved instrument is future host work** (an asset field in the document).

## Producers and consumer

| Piece | Where | Contract |
|---|---|---|
| `bundledStitchRegions(spec)`, `stitchRegionsOf(domain)`, `regionBoundaries(regions)` | `composition/stitch-regions.ts` | Frozen labelled regions (`id`, `index`, `label`, `domain`, `tone`); the four bundled sources; the closed boundary rings as `Path`s so any path material can draw them. Cached by construction. |
| `stitchField(spec)` | `composition/stitch-field.ts` | The direction field: constant, radial (spokes turned by `angle`), swirl (radial turn plus `twist` per 100 units), image (foundation `imageField` orientation blended, as double-angle vectors, with the constant angle by `follow x coherence`). |
| `runningStitches`, `spanStitches`, `boundStitches`, `routeRuns` | `composition/stitch-route.ts` | Stitch cutting and greedy nearest-endpoint routing; no knowledge of regions. |
| `stitchThreads(options)` | `composition/stitch.ts` | The producer: per region inset, underlay, fill (running, satin, seed, mixed), crossing layer, outline, seam, routing, travel. Returns frozen ordered `StitchThread`s, per-region labels and stats. |
| `regionStitchComposition`, `regionStitchProducts`, `stitchRuns`, `drawStitches`, `drawStitchProducts`, `prepareStitches` | `composition/stitch-draw.ts` | The JSON-compatible descriptor, its producer, colour rules, drawing through `strokeWith` + `pathMaterial` (ink, dashes or beads) or any replacement `PathMaterial`, cooperative preparation. |
| Definition and controls | `adapters/region-stitch-instrument.ts` | Parameters, groups, conditions, defaults, `regionStitchFromValues`. |

Reused, not rewritten: `planarDomain`/`offsetDomain`/`clipPath`/`hatchDomain`/`locateInDomain`/`textDomain`/`labelDomains`/`domainUnion`
(the planar-domains foundation), `segmentValueBands` and `imageField` (image structure), `traceStreamlines`, `partitionRegions`,
`pathMaterial`, `strokeWith`, `componentSeed`. Nothing was added to a foundation module.

## Frozen semantics

- **Stitch and thread.** A stitch is one straight segment between two penetrations; a thread is a polyline of penetrations. **Every stitch of
  every thread, including connectors, outlines and travel, is at most `Stitch length`** (checked to 1e-9; computed points can exceed it by a
  few ulps). Stitches shorter than 1e-9 do not exist. Curved rows are cut by arc length, so chords are shorter than the arc.
- **Rows.** A constant field gives the exact hatch (`hatchDomain`), anchored at the footprint centre so neighbouring regions' rows align. Any other field
  gives Jobard-Lefer streamlines (separation `Row spacing`, crowding stop 0.8, starts on a lattice of four spacings, ids `row:<i>:<j>`) traced once
  per distinct field/turn/bounds/spacing and clipped to the fill domain. Measured: neighbouring rings of a radial ring field are at least 0.8 and at
  most about 2 spacings apart (tested).
- **Fill rules.** `running`: stitches of exactly `Stitch length` along each row piece; the first cut of a row lies `stagger * u * L` in (u from
  `componentSeed(seed, row id, "phase")`). `satin`: one stitch per row piece, or `ceil(length / L)` equal parts. `seed`: one candidate per `Row spacing`
  cell (jitter +-0.425 cell), inside the fill domain, oriented along the field turned by `scatter * pi * (u - 1/2)`, length `L * (1/2 + u/2)`, clipped to
  the region (dropped if under a quarter of its length). `mixed`: the rule per region from `componentSeed(seed, region id, "rule")`.
- **Holes stay open, regions stay separate.** Every non-travel stitch lies in its own region (exact clip, tolerance 1e-6 units for the rounding of computed
  row ends): rows are clipped exactly, curved chords are clipped again, connectors join only when they lie in the region, so a hole ends threads instead of
  being bridged. `Region inset` is `offsetDomain(region, -inset)`: holes grow by the same amount, narrow regions vanish (a valid empty drawing).
- **Routing.** Greedy nearest endpoint from the seam; adjacent parallel rows alternate direction as a consequence, not by a rule. A row continues the
  thread when the connecting stitch is at most `L` and inside the region; otherwise the thread ends (a trim, nothing is stitched). **Disconnected regions and
  gaps get no visible travel unless `Show travel stitches` is on**; then each gap gets a straight thread cut equally to the bound.
- **Seam.** A ring's seam is its support vertex in the seam direction (degrees, 0 = +x, clockwise on screen) about its bounding-box centre: where outlines
  and edge underlay begin and end, and where a region's routing starts. `Seam lap` continues the outline thread that far over its own start.
- **Underlay and crossing.** Underlay first (edge ring, cross rows at 90 degrees to the fill), fill, crossing layer (rows at `crossAngle` from the fill,
  staggered by up to half a stitch), outline last; the crossing is the visible overlap of threads (thread alpha shows it).
- **Ids, seeds, ownership.** Threads are `<region>/<tag>:<n>` (`ue`, `uc`, `f`, `c`, `o`) and `travel:<n>`; seeds `componentSeed(seed, id, "thread")`. Results are
  deeply frozen and cached by the identity of the regions array then the construction (the seed only where read); colour, weight and material never enter a key or an
  id (`regionStitchProducts` returns the same object after an appearance edit; tested with `===`). Regions are independent: removing one leaves the others'
  threads identical (tested). `usesSeed` is honest: a constant field without stagger, spread, seed stitches, crossing layer or per-stitch colour ignores it.
- **Colour.** Palette entry 0 is the base thread (underlay, travel, outline and crossing under `trim` ink); regions take entries 1..n-1 (`region`, `tone`,
  `row`, `stitch`). Colour is applied to runs of consecutive same-colour stitches, so a one-colour thread is one path.

## Controls (groups; proportional clusters; conditions)

Groups in order: **Regions** (source, word, letterWeight, variant, patches, merge, windows, image, bands, minRegion, leaveLightest); **Placement**
(centerX, centerY, proportional **Size** width/height); **Direction** (field, angle, fieldX/Y, twist, fieldImage, fieldVariant, follow, smoothing,
angleSpread); **Stitches** (fill, proportional **Scale** spacing/stitchLength, stagger, scatter, inset); **Underlay**; **Crossing**; **Outline**;
**Seam and routing** (seam, order, travel); **Thread** (thread, weight, dash, colorBy, trim). Proportional: Size (both canvas lengths) and Scale (row spacing and
stitch length, scaling the texture uniformly). Conditions are inline `visibleWhen` on selects: `word`/`letterWeight` under letters; `variant` under blob, quilt,
tones; `patches`, `merge`, `windows` under quilt; `image`, `bands`, `minRegion`, `leaveLightest` under tones; `fieldX/Y` under radial and swirl; `twist` under swirl;
`fieldImage`, `fieldVariant`, `follow`, `smoothing` under image; `stagger` under running and mixed; `scatter` under seed and mixed; `underlaySpacing` under cross and
both; `underlayInset` under any underlay; `crossAngle`, `crossSpacing` under crossing; `outlineWidth` under satin; `lap` under any outline; `dash` under dashes and
beads. Controls left visible because their relevance is a disjunction (the audit lists them): `trim` (outline or crossing layer), `order` (matters only with more than one region) and `height`
(matters for letters and pictures only when the footprint is not square-limited). Hidden controls are dropped from the resolved descriptor, so they cannot reach a key or a drawing. Audit
(`tests/helpers/audit-controls.ts region-stitch`, 48 controls, 3,135 probes, sampled): zero violations, zero dead controls, zero unknown; plus the property test over four configurations.

Slider intervals versus hard limits: spacing 1.5-10 (hard 0.8-200), stitch length 2-24 (hard 1-200), inset 0-14 (hard 0-1000), letter weight 0-14 (hard 0-60), patches 3-30
(hard 1-60), tone bands 2-8 (hard 2-8), regions at most 512, thread width 0.4-4 (hard 0-50), and so on: see the definition. Sliders are the useful spans found by looking; the
hard limits are semantic or the measured bounds below.

## Work bounds (throw naming the control; nothing is thinned)

`STITCH_LIMITS`: 300,000 stitches, 150,000 threads, 60,000 rows, 1,500,000 streamline steps, 200,000 seed cells per construction, 512 regions. Stitches are estimated from the
regions' area before anything is built (`estimateStitches`: area / (spacing x length) plus cross layers) and counted exactly as they are made; messages name Row spacing,
Stitch length, Smallest region or Tone bands. Stored values alone do not bound the work (it depends on the regions' area), so the definition has no stored-values `validate`;
the producer throws first thing, before tracing. Cancellation reaches the streamline tracer, the router and the row loops; a cancelled build is not cached.

## Measured timings

Development machine, Node 22, one thread, drawing into a string-building SVG surface (not a p5 canvas, whose per-call cost is not measured here). "Prepare" is regions plus
threads on a cold cache; an appearance edit (thread width, dashes, colour rule, palette) reuses the threads and only recolours and redraws; a structural edit rebuilds the threads.

| Case | Stitches | Paths drawn | First prepare | Appearance-only edit (draw) | Structural edit |
|---|---|---|---|---|---|
| Default quilt, 520 x 520, spacing 3.2 | 18,431 | 414 | 42 ms (+15 ms draw) | 29-64 ms | spacing 2.6: 35 ms; seam: 23 ms |
| Dense quilt, 640 x 640, spacing 1, length 3 | 153,375 | 760 | 71 ms (+61 ms) | 52 ms | spacing 1.2: 98 ms |
| Blob, swirl field, spacing 1.2, length 4 | 22,684 | 1,290 | 336 ms (+10 ms) | 9 ms | twist 90: 311 ms |
| Portrait tones, image field, 640 x 640, spacing 2.4 | 33,037 | 2,577 | 874 ms (+19 ms) | 13 ms | follow 0.5: 851 ms |
| Seed moss, 640 x 640, spacing 2 | 104,537 | 92,775 | 521 ms (+257 ms) | 200 ms | not measured |
| Image field tones, spacing 1.2 (extreme) | 80,773 | 4,673 | 2.7 s | 33 ms | seconds |

Curved (non-constant) fields dominate: streamline tracing evaluates the field about 4 times per step. The exact hatch of a constant field is near-free. `Color by` stitch and seed
moss make one path per stitch, the slowest to draw.

## Evidence

`tests/composition-region-stitch.test.ts`: analytic stitch lengths of the three cutting rules (25 = 10 + 10 + 5; 25 x 4; equal parts), routing on parallel rows (alternation, refusal
splits, point conservation), the field definitions (radial and swirl against `atan2`; a striped raster followed at `pi/2`, follow 0 exactly the constant angle), a 100 x 40 rectangle
(one thread, 109 stitches, length 1036, alternating rows, aligned penetrations at stagger 0), the same with a hole (horizontal stitch length 1000 - 5 x 20), inset (8 rows of 90),
satin (40 stitches of 25), curved ring rows (radius spread, tangent direction of every stitch, ring gaps), a circular hole with rows hugging its edge, the angle convention at four
angles, seed stitching (density against 8000/9 cells, scatter 0 and 1), underlay edge/cross, crossing angle, outline seam corners and lap length, satin band width, region
independence, travel endpoints and bound, the bound and containment property for every source x rule x field, region topology (THREAD's three counters, blob disjointness, quilt
area conservation, windows do not rename), freezing and identity caching, cancellation, work-bound messages, registration, hidden controls, colour rules and run conservation, and
layering with FM Engraving in both orders (the recorded draw calls are unchanged blocks).

**Mutations confirmed to fail** (11 tried; each fails 1 or more tests): stagger ignored; joins ignore holes; curved rows not re-clipped; satin `ceil` to `floor`; field angle sign; satin band
normal flipped; inset grows instead of shrinks; seam picks the far side; routing takes the farthest end; running cut step 1.5 L; radial `atan2` arguments swapped. Two survived the first suite (curved chords
into holes; the constant angle's sign) and each got a test.

## Defects found by looking, and fixed

- Letters stitched from the font's own strokes (about 8 units wide) vanished under the default inset: added `Letter weight` (offset before regions are cut).
- Zero-length and near-zero stitches at the places where a clipped zigzag touched the boundary (found by the property test): removed by `distinctPoints` and `boundStitches`.
- Rows almost never joined: the exact closed-region test rejected connectors between computed row ends that rounded a few ulps outside the boundary; joins now allow 1e-6 units.
- Dark underlay at spacing 9 dominated the fill; default 12, thread 1.7.
- The first quilt default was a single large patch (variant 5); variant 12 with eleven cuts gives seven balanced patches with a window and joined L shapes.

Images reviewed (all defaults, seeds 1, 2, 3, structural settings, sparse and dense, both layer orders) are listed in the report; they are throwaway renders, not registered in the visual review.

## Non-goals and open concerns

- No machine format, density compensation, stop/trim/colour-change model; no thread physics.
- Rows for non-constant fields are evenly spaced within 0.8-2 spacings, not exactly constant; a constant field is exact.
- Curved rows are traced once per region group over its padded bounds and clipped: a large empty bounding box (letters) costs tracing it. Image fields at spacing 1.2 over a 640 canvas take seconds.
- The `tones` regions are traced from a 128-pixel picture and simplified to 1.6 pixels; edges are polygonal, not smooth.
- Quilt joining uses the union of two edge-sharing patches; windows are rectangles.
- Binding user assets (outlines, pictures) to a saved instrument is future host work.
- Real Studio interaction, layered work in the app and responsiveness through the host are not exercised.

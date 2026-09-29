# Stroke Relief (brief 12)

Status: **implemented on branch `w2/stroke-relief`, unreleased. Reviewed from rendered output only; not yet
exercised through the real Studio interface, layered in the app, or reviewed for responsiveness there.** It builds on the
frozen [reference slice](composition-reference-slice.md) and [structural operators](composition-structural-operators.md)
boundary. Guide: `packages/instruments/guides/stroke-relief.md`.

## Artist-facing brief

Paths with width and pressure become a height field; the height field, lit from a movable light, becomes a transparent
patch of highlights and shadow that follows the strokes: ridges along edges, furrows along the length, a wall where one
stroke lies over another. The flat colour version is a separate, independently usable layer, and the patch can be drawn
alone over anything. This is a 2.5D material, not a paint rheology solver, and no claim about physical paint or fabrication.

## Input contract (F3, resolved strokes)

The library defines a typed, deeply frozen, RESOLVED value and never fetches, decodes or captures
(`composition/strokes.ts`). A `ReliefStroke` is a `Path` (so every path material can stroke its centerline) with a full
**width** in canvas units and a **load** in [0, 1] per vertex; a `StrokeSet` is an id-unique list with a seed and a 64-bit
content fingerprint. Instruments persist only technique id, scalar params and palette, so the instrument selects a
BUNDLED set through a validated select; the direct API and the typed descriptor accept any `StrokeSet` a caller
resolved. Binding a user's own strokes to a saved instrument is future host work (an asset field in the document).
Limits: 0-600 strokes (none is a valid empty drawing), 2-50,000 vertices each and 400,000 in all, coordinates within ±1e5,
widths in [0, 2000], loads in [0, 1]; each failure names the stroke and field.

## Producers and consumers

| Piece | Where | Contract |
|---|---|---|
| `strokeSet`, `strokeData`, `placeStrokes`, `scaleWidths`, `depositionOrder`, `paintMass` | `composition/strokes.ts` | Validation, JSON round trip, similarity about the centerline bounding-box centre, width scale, the four order rules. Cached by set object. |
| `strokesFromPaths`, `strokeFromGesture` | same | Any path list (e.g. contour chains or the existing bristle hairs) or a replayed gesture as strokes. |
| `bundledStrokes(id, seed)` | `composition/stroke-samples.ts` | Five closed-form ribbon sets; the seed is the take (geometry, not decoration). |
| `depositHeight(set, options)` | `composition/relief.ts` | `StrokeRelief`: `height`, `owner`, `coverage`, `pairs`. Cached by set and options. |
| `reliefNormals(relief)` | same | Slopes by the existing signed convolution (`convolve2DSigned`, Sobel kernels). Cached on the relief. |
| `shadeRelief(normals, light, material)` | same | `ShadedPatch`: nested iso-band polygons. Cached on the normals by light and material. |
| `pigmentField(relief, tones)` | same | Pigment tone per cell; colour never enters any producer. |
| `IsoField`, `fillableRings` | `composition/iso-rings.ts` | Linear-time oriented level-set rings of a sampled field, and hole merging for filling. |
| `strokeReliefComposition`, `strokeReliefProducts`, `drawStrokeRelief`, `prepareStrokeRelief`, `flatRibbon`, `shadedPatch` | `composition/stroke-relief.ts` | JSON-compatible descriptor, its producers, the two default consumers (replaceable by ordinary callbacks), cooperative preparation. |
| Definition and controls | `adapters/stroke-relief-instrument.ts` | Parameters, groups, defaults, conditions. |

Existing computations reused: `convolve2DSigned`, `gesturePath` + `bristleBand` (the dry-brush source: each hair one
stroke), `mapPressure` (load to height), `componentSeed`, `strokeWith`, `createCompositionRun`, `memoized`, `fillRings`.
Nothing existing was refactored, so no existing drawing changed: 20 drawings (ten instruments, two seeds) fingerprint identically before and after.

## Frozen semantics

The full specification is the header of `composition/relief.ts`; the decisions:

- **Grid.** Cells are sampled at their centres; the requested cell size is only ever reduced so columns fit the bounds
  (`c = width / ceil(width / cell)`). At most 262,144 cells. A stroke thinner than about two cells aliases; grooves are
  never narrower than 1.6 cells (too many furrows fuse rather than alias).
- **One stroke.** `h = H · A(p) · P(u) · (1 − G)`: peak height, load map (`mapPressure`), cross-section `P` of the lateral
  position `u = d / hw`, furrow cut `G`. Where several segments of one stroke reach a cell (bends, self-crossings) the
  stroke's own value is that of the nearest centerline point whose footprint holds the cell: a stroke never adds to itself
  and subdividing a straight run never changes a value (tested; found by a test, an earlier max-over-segments rule
  drifted with vertex spacing).
- **Overlap** (caller's choice, in deposition order): `add` `h+v`; `max` `max(h,v)`; `displace` `(1−c)h + cv`, `c` the
  one-cell antialiased coverage. Crossing of loads 1 and ½, height 10: add 15, max 10, displace 5 (later is the half-loaded
  one) or 10 (reversed). These values are asserted exactly.
- **Ownership** is the same for all three: the last stroke in deposition order whose footprint (`d <= hw`) holds the cell.
  It is exactly what the flat layer shows when it paints ribbons in that order, and it never depends on the overlap rule.
- **Order rules.** `drawn`, `reversed`, `shuffled` (by `componentSeed(seed, id, "order")`, stable under filtering) and
  `heaviest-last` (ascending ∫ width·load ds).
- **Light.** `azimuth` degrees clockwise from the top of the canvas (the direction the light comes from), `elevation`
  degrees above the surface. Signed shading `s = contrast (n·L − L_z) + gloss max(0, (n·H)^p − H_z^p)`: exactly 0 for a flat surface.
- **Patch.** `|s|·w` (`w` = footprint weight: 0 at the footprint edge, 1 half a cell inside) is banded into 16 nested regions
  (`(k − ½)/16`) as filled polygons with sub-cell contours; each region's alpha compounds with the shallower ones to
  `k/16 · 0.85` exactly. Transparent outside the strokes and where the surface is flat. Palette entry 0 is the shadow,
  entries 1.. the pigments, and the light colour is white tinted 20% toward entry 1.
- **Ids, seeds, units.** Stroke seeds `componentSeed(setSeed, strokeId, "stroke")`; bundled ids `<set>:<seed>/<name>`. Canvas
  units; option angles degrees; slopes dimensionless. Appearance (palette, colour rule, light, view) never renames or moves
  a stroke or changes the height (asserted: the height, normals and pigment objects are identical across light edits).
- **Limits (throw naming the control, nothing truncated).** 262,144 cells; 60,000,000 cell-segment tests (about a second
  at the limit; the default uses 0.8 million); 800,000 shading polygon vertices; drawing budget 400,000 callback units.
  Cancellation is checked between strokes and every 64 segments.

## Controls and groups

Sections: **Strokes** (stroke set, stroke width; nested *Dry brush*: proportional *Widths* brush width + hair width, hairs,
dryness, depletion), **Placement** (centre X/Y, scale, rotation), **Relief** (cross-section, height, edge ridge; nested
*Furrows*, *Load*; cell size), **Deposition** (overlap, order), **Light** (direction, height, shading depth, gloss,
highlight tightness), **Drawing** (show, colour by). The only proportional group is the dry brush's brush width with hair
width (one quantity in one unit).

Inline `visibleWhen`: ribbon width by ribbon sets; the dry-brush group by dry sets; every relief and light control by
`view` in relief/both; the furrow controls also by `section` furrowed; colour by `view` in flat/both. Left visible:
`order` (matters in the flat view through painter order and in the relief view only through displacement: a disjunction, the
audit's one disjunctive control) and `shininess` (matters only when gloss is above zero: numeric). The control audit
(`tests/helpers/audit-controls.ts stroke-relief`: 28 controls, 1,366 probes) reports zero violations, no dead controls and no
proposed further conditions. A property test changes every hidden control in five configurations and requires an unchanged drawing.

## Checks

`tests/composition-stroke-relief.test.ts` (27 tests): stroke validation, freezing and fingerprints; the four order rules
and shuffle stability; exact heights of one straight stroke (cross-section, cap, footprint edge, load map, taper) and
invariance to vertex spacing; volume against an analytic integral at three cell sizes; exact crossing heights and owners
for every overlap rule and order; a stroke crossing itself; the whole deposition against an independent brute-force
reference (all rules and orders, random strokes); order invariance of add/max; furrow count and depth; edge ridge; slopes
of a ramp exactly and normals of a dome against `prepareSurfaceAttributes3D`; closed-form shading; the patch's exact
alpha compounding, footprint containment and clear flat tops; iso-ring crossings, orientation, holes, saddles and border
closure; placement; conversions; bundled sets; work bounds; cancellation; light edits leaving upstream objects identical;
descriptor against ordinary functions and consumer substitution; colour rules; the dry-brush source against the bristle
producer; conditional visibility and the irrelevance property. Mutations confirmed to fail: first-wins ownership,
displace as add, maximum as add, flipped slope sign, missing flat baseline, last-segment-wins, uncompounded band alpha.

## Review record

Rendered with a throwaway SVG surface under the native lease (defaults at three seeds; all five ribbon sets and three dry
brushes; add/max/displace and both orders; flat only, relief only, both; round, flat and furrowed sections; raking and
overhead light; sparse fragment, dense off-slider weave, coarse cell 6; a combined dry-spiral setting; layered with Contour
Scores and Region Quilts, both orders; a flat layer with a differently lit relief-only copy). Defects found by looking and fixed:

- shading as merged cell rectangles stair-stepped every diagonal edge and showed horizontal seam lines at fractional
  scale: now nested iso-band polygons (smooth at any zoom, no seams);
- the patch spilled a half-cell halo past the stroke: the shading is weighted by the footprint weight, zero at the edge;
- first grooves were mottled noise (sub-cell aliasing): groove width floored at 1.6 cells, fewer default hairs;
- neighbouring grooves merged into one trough: jitter reduced to ±0.18 of a pitch (found by the groove-count test);
- the height drifted with vertex spacing when the load varied along a stroke: nearest-point rule (found by a test);
- the first default read as inflated plastic tubes and additive crossings looked transparent: default is now furrowed,
  displacing, with an edge ridge and a lower gloss;
- dry-brush hairs as separate displaced cords read as rope: use maximum overlap, a flat section and wider hairs (guide);
- contour rings with many holes made hole merging quadratic (650 ms per light edit): `fillableRings` (95 ms);
- the vertex limit's message named no control; a replay's pressure overshoots 1 by 2e-16 (clamped).

Timing (Node, null surface, this machine; real canvas cost is higher): default first preparation 277 ms (source 5, deposit
50, normals 60, patch 95, plus drawing); palette or colour edit 4 ms; light edit 80 ms; structural edits 215-250 ms. Large
setting, woven bands at width x1.6, height 20, cell 2: first 375 ms, light edit 555 ms, overlap-rule edit 1.1 s; dry brush with
40 hairs: first 123 ms, light edit 18 ms. The 60-million bound is measured, not
a promise: dense stacks of wide strokes at cell 1.5 reach the 800,000-vertex limit and throw.

## Open concerns and decisions to confirm

- Persisted instruments name only bundled sets; supplying strokes needs a host asset field. The bundled sets are synthetic.
- The patch's colour roles are palette entry 0 (shadow) and the others (pigments); a host palette editor should say so.
- `fillableRings` duplicates the purpose of `keyholeRings` (type-text.ts) with a scalable search: `keyholeRings` was left
  untouched so typographic drawings stay identical. The planar-domain foundation (holes, Booleans) should replace both.
  `IsoField` likewise sits beside the quadratic chain assembler used by contour paths.
- Light edits cost 80-550 ms of synchronous work; a host may want to debounce a light slider. No cheaper preview is offered.
- Shading of a stroke thinner than two cells is undersampled by design (documented resolving limit).
- No overlap of the flat layer with `max`-mode height crests: pigment ownership is painter order in every rule.
- Real-interface acceptance and layered work in the app are root's to exercise. Dry-brush source uses `bristleBand` from
  `gesture.ts`; a parallel Dry Bristle Strokes module exists on main but is not on this branch.

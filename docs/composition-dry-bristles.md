# Dry Bristles (brief 10)

Status: **implemented on branch `w2/dry-bristles`, unreleased. Reviewed from rendered output only;
not yet exercised through the real Studio interface, layered in the app, or reviewed for
responsiveness there.** It builds on the frozen [reference slice](composition-reference-slice.md)
and [gesture scores](composition-gesture-scores.md) boundary. Guide:
`packages/instruments/guides/dry-bristles.md`.

## Artist-facing brief

A few broad strokes of separate hairs with gaps, taper and depleted ink, laid along any path, beside
fine stitched contours drawn by the existing `pathMaterial`. The brush follows harmonic traces, a
contour family or a hand scribble with the same controls. Sparse dry fragments and dense overpainted
ribbons are the same instrument with different settings.

## The extraction

The bristle consumer that lived inside `gesture.ts` (`bristleBand`) is now the general brush in
`composition/bristle.ts`. **Gesture Scores calls it**, not a copy: `bristleBand(gesturePath, ...)` is the
same function, and a path that already carries `arcs`, `angles` and `pressure` (a `GesturePath`) is used
as given. Also moved there: `PressureMap`, `mapPressure` and the small helpers (`unit`, `range`,
`cachedBy`, `seedOf`) that `gesture.ts` keeps importing; `tonedMaterial` moved to `materials.ts`; the
unused `seed` field of the old `BristleOptions` was removed (hair draws always used `path.seed`);
`hairMaterial` (ink through `pathMaterial`) draws the hairs of both instruments.

Existing drawings stay identical: `drawFingerprint` and a SHA-256 of every hair (id, seed, tone, all
points) for 27 Gesture Scores configurations (defaults of `sweep`, `loops`, `spiral`, `scribble`, `wander`,
a dense four-repeat setting, a window fragment, speed pressure and an ink line, each at seeds 1, 42 and
7777) are equal before and after. The old gesture defaults are the new options' defaults (square brush,
even strata, no cohesion, no tip, `attack` 36, `release` 0, no paper).

## Producers and consumers

| Piece | Where | Contract |
|---|---|---|
| `bristleTrack(path, frame)` | `composition/bristle.ts` | Frozen `BristleTrack`: the path resampled at a fixed **arc-length** step (`resamplePolyline2D`), a travel direction per station, and pressure from the path's profile. Cached per path and frame. |
| `bristleContact(track, options)` / `bristleBand` | same | The brush: frozen hair `Path`s (`BristleHair`: `hair`, `tuft`, `shade`), per-station `contact`, footprint rings, `hairLength`, `inkLoad`, `area`. Cached per track and options. |
| `bristleStroke(path, frame, options)`, `planBristles`, `bristleStrokes` | same | One path; a family under one work bound checked before any hair exists. |
| `hairMaterial`, `drawFootprint`, `drawBristleStroke`, `bristleMaterial(spec, palette)` | same | Consumers: hairs as `pathMaterial` ink with a stable per-hair colour mix, an optional footprint wash, and the whole thing as a `PathMaterial` for `strokeWith`. |
| `bristleSourcePaths(seed, source)`, `pathSet(data, seed)` | `composition/bristle-sources.ts` | Frozen cached `Path[]` for the bundled sources and for caller-resolved data. |
| `dryBristlesComposition`, `dryBristlesPlan`, `dryBristlesStrokes`, `drawDryBristles`, `prepareDryBristles` | `composition/dry-bristles.ts` | JSON-compatible descriptor, its producers, drawing through `strokeWith` / `pathMaterial`, cooperative preparation. Any consumer (`hair`, `line`) is replaceable. |
| Definition and controls | `adapters/dry-bristles-instrument.ts` | Parameters, groups, `visibleWhen`, defaults. |

Reused, not rewritten: `resamplePolyline2D`, `gradientNoise2D01` (paper), `contourPaths`, the Harmonic
Traces sampler (`harmonicTraceCurves`), `gestureTrack` / `gesturePath` and the bundled recordings,
`pathMaterial`, `strokeWith`, `componentSeed`, the composition run budget.

## Frozen semantics

- **Frame.** Stations are equally spaced by arc length (at most `step` apart). The direction at a station
  is the chord across its two neighbours, so a corner turns the frame through its bisector; the ends use
  second-order one-sided differences (a first-order end tangent lags on a curve: measured, the inside hairs
  of a radius-40 circle came within 1.3 units of the centre instead of the limit of 4). A hairpin keeps
  the incoming direction. Directions are never unwrapped or re-signed, so a hair cannot change side. A
  closed path is opened at its first vertex (the brush lifts at the seam).
- **Hair.** Hair `k` of `n` has offset `o` = a jittered stratum of `(-1, 1)`, then `clumping` squeezes it
  toward its tuft centre by `0.9 * clumping`, then `bias` maps `|o|` to `|o|^(2^(1.5 bias))`. It sits at
  `o * halfWidth` along the cross-section `u = (-sin θ, cos θ)` where `θ = angle + tilt` (`path` hold; tilt
  0 is exactly the earlier brush) or `θ = tilt - 90°` (`canvas` hold), plus a closed-form waver in arc length.
  `halfWidth = width * mapPressure(p) * taper(arc) / 2`.
- **Contact.** A station touches when `mapPressure(p) >= dryness * (0.65 u + 0.35 |o|) * (0.55 + 0.9 g(arc)) +
  strength * (0.5 - tooth(x, y))`, the progress along the path has not passed the hair's depletion point
  `1 - depletion * (0.15 + 0.85 u)`, `arc >= attack * u` and `arc <= length - release * u`. `g` is a per-hair
  sine of the path's own arc length. The paper `tooth(x, y)` is two octaves of gradient noise of the
  position only (stretched about 0.5, [0, 1]), the same for every stroke, so hard pressure fills it and
  crossing strokes share their gaps. Everything is a function of arc length or canvas position: **stations
  shared by two steps agree exactly** (tested).
- **Correlation.** Each draw is `(1 - cohesion) * own + cohesion * tuft` (tuft draws are seeded by
  `tuft:<t>`), so at cohesion 1 the hairs of a tuft differ only by their offset's share of the threshold and
  therefore lift in a nested order.
- **Inside a turn** the normal component of the offset is limited to 90% of the local radius of curvature
  (turning rate from the neighbouring stations); the limit follows the cross-section (`cos` of its angle
  to the normal), so hairs bunch instead of crossing.
- **Tips.** Width multiplies by `entry(s)` and `exit(s)` (their minimum) with `s = distance / length`:
  round `sqrt(1 - (1 - s)^2)`, pointed `s`, dragged = blunt entry and pointed exit.
- **Pressure profile** (paths with none of their own), `u = arc / length`: even `level`; swell `sin(πu)^0.8`;
  press-lift `1 - u^1.6`; pulses `0.5 + 0.5 cos(2π(n u + phase))` with a stable per-path phase.
- **Outputs.** `contact[i]` is the fraction of hairs on the paper at station `i`. `footprint` is one ring per
  stretch of at least two touching stations (outermost touching hairs, one side forward and the other back;
  not necessarily simple inside a tight turn). `inkLoad` is the arc-weighted mean of `contact`; `hairLength`
  the total length of all published runs; `area` the touched span integrated along the path. Runs of one
  station are not published (they still count in `contact`).
- **Ids and seeds.** A stroke keeps its path's `id` and `seed`; hair runs are `<path id>/hair:<k>@<start>`
  (start is the moment in ms for a recording, the arc length otherwise); seeds `componentSeed(path.seed, id,
  purpose)`. Ink, weight, mix, wash, palette and lines never enter a producer or a cache key.
- **Heavy strokes.** Eligible paths (length at least *Shortest heavy path*) are ranked by a stable draw; the
  first `ceil(share * eligible)` are brushed. A stroke's width is `width * (1 - variation * u)` with a
  further stable draw. Raising the share adds strokes and leaves the earlier ones the same cached objects.
- **Sources.** *Traces*: `trace:<i>`, `count` phase-shifted copies of `x: A cos(a t)`, `y: A cos(b t)` plus two
  small terms at `2a+1`, `2b+1` cycles; the seed sets the phases and the small terms' amplitude. *Contours*:
  `contourPaths`, footprint `474 x 460` times *Scale*. *Scribble*: a bundled recording replayed with speed
  pressure at 3-unit arc stations and cut into strokes at the sharpest bend (24-unit turning) between
  `strokeLength` and `1.6 x` past the previous cut, while at least `2.1 x` remains, so every stroke but the
  last is `1x` to `1.6x` and the last `0.5x` to `2.1x`. Data: 1,000 paths, 200,000 points, coordinates within
  ±1e6, unique ids, two finite points each.
- **Units.** Canvas units; option angles degrees, published angles radians.
- **Limits and failure.** Hairs 1 to 400; a path at most 20,000 stations; **hairs × stations summed over the
  brushed family at most 600,000**, checked before any hair exists and reported with the controls to change.
  Empty (zero-length) paths are valid empty strokes; non-finite input, unknown options and bad data throw.
  The family bound depends on path length, which depends on the seed for traces and scribble.
- **Draw order.** All footprint washes, all hairs, then the fine line. Colours (1-based palette): hairs 1,
  fine line 2, second pigment 3, footprint wash 4. Callback budget 400,000 units (one per hair path).

## Controls and groups

Sections in order: **Paths** (source; figure, traces, spread; field, frequency, count, interval; hand,
stroke length), **Placement** (center X/Y, scale, rotation), **Heavy strokes** (share, shortest heavy path,
width variation), **Brush** (proportional *Scale*: brush width and hair weight; hairs; *Distribution*: bias,
tufts, clumping, cohesion; *Hold*: hold, edge angle; path step), **Pressure** (profile, level, presses,
*Light touch*: floor and curve; tip, tip length), **Dry contact** (dryness, depletion, waver, *Ends*: entry
and exit; paper tooth, strength, grain), **Color** (second pigment, footprint wash), **Fine line** (line,
weight, stitch spacing and phase, trace heavy strokes). The only proportional group is *Scale*: both are
lengths where zero means none, and scaling them together is one edit (a heavier brush). Entry and exit are
lengths too, but changing them together is two decisions, so they are not marked.

Inline `visibleWhen`: figure, traces and spread by `source` traces; field, frequency, count and interval by
contours; hand and stroke length by scribble; pressure level by `even`; presses by `pulses`; tip length by any
tip but blunt; tooth strength and grain by paper tooth; line weight and trace-heavy by ink or stitch, stitch
controls by stitch. Field frequency matters for every field (the property test found that `saddle` and
`hills` use it), so it is conditioned only on the source. The audit
(`tests/helpers/audit-controls.ts dry-bristles`: 49 controls, 2,199 probes) reports zero violations and no
proposed further conditions; two controls are reported as disjunctive (relevant under several selections, so a
conjunctive condition cannot state them) and stay visible.

## Checks

`tests/composition-dry-bristles.test.ts` (22 tests): exact ink load, hair length and strata of a solid brush;
ink load within 1% (hair length within 5%) across 4,000-, 300- and 90-vertex versions of a curve at steps
1 to 6; stations shared by steps 1 and 2 agree exactly; corner frame angles stay in the corner's range,
every hair keeps its side and order, a hairpin stays finite; the inside limit on a radius-40 circle and its
absence for a narrower brush; tilt geometry, canvas hold thin along its edge and broad across; tip widths
for three shapes against their formulas; clumping about tuft centres and bias densities against
`1/(e+1)`; cohesion nests the touching hairs and independence does not; paper contact equals
`tooth(x, y) >= 0.45` on a light-pressure stroke and hard pressure fills the tooth; edge hairs lift first,
depletion's 85% bound, entry and exit shares; closed, empty and invalid paths; the work bound at exactly
600,000 and 600,400 points, for a path and a family; a gesture path used as given; appearance leaves
producers untouched and share only adds strokes; source identity, freezing, seed structure and scribble
stroke lengths; path data validation; descriptor and consumer replacement; wash order; cooperative
preparation and cancellation; every consequential control changes the picture and hidden ones do not.
Mutations confirmed to fail: station-index streaks, station-index entry, removing the inside-turn limit,
ignoring cohesion, flipping the paper's sign, first-order end tangents. The existing conditional-controls
property test also runs over this instrument.

## Review record

Rendered with a throwaway SVG surface: defaults at three seeds; harmonic traces (default, 5:4 with four
chisel traces and dragged tips, six spread traces at share .6); contours (waves with a hollow edge-heavy
brush and wash, hills with combed pointed tufts, saddle sparse very dry fragments, wide 150-hair dense
strokes, tilted brush); hand scribbles (dabs of 140 with pulses and a second pigment, the sweep as one
blunt stroke); combined settings; layered with Region Quilts and Motif Ecologies (unmodified) in both
orders. Defects found by looking and fixed:

- the first defaults were too dense and dark to read as dry: fewer, finer hairs, higher dryness,
  depletion and tooth, and tufts that split the stroke;
- with few paths (three traces) a per-path random share brushed none at the default share: selection is now
  a rank (`ceil(share * eligible)`), still stable and additive;
- inside a tight turn the innermost hairs crossed the path's centre because a first-order end tangent lagged
  (found by the circle test): second-order end differences;
- the scribble's last stroke could be nearly empty: cuts continue only while 2.1 strokes of path remain;
- `contourFrequency` was hidden for two fields where it matters (found by the property test): visible for all
  contour fields;
- *Exit* has no visible effect while depletion has emptied the brush before the end (the default): documented
  in the control and the guide rather than disguised.

Timing (Node, null surface, this machine; canvas drawing costs more): default first preparation and draw
70 to 85 ms, appearance-only edit 4 to 6 ms, structural edits 16 to 50 ms. At the work bound (largest
passing hair count: 90 hairs on three 1.5-unit traces, 319,000 published hair points; 47 hairs on the
contour family at step 1, 303,000 points): first preparation 140 to 280 ms, appearance-only edit 10 to
22 ms, structural edit (dryness or seed) 145 to 235 ms. Only about half the hair points allowed by the
bound are published at these settings because dryness lifts hairs.

## Open concerns and decisions to confirm

- Persisted instruments name only bundled sources. Binding a user's paths needs a host asset field; the
  descriptor (`{kind: "paths"}`) and the functions already accept data.
- No image-directed source yet: brief 10 names them, but raster/image structure lives on another branch. The
  same `Path[]` interface is what an image tracer would feed.
- The brush lays hairs as constant-alpha ink; ink depletion is hairs running out, not fading. A fade would be a
  separate consumer choice over the same `contact` data.
- Polygon holes are not used: the footprint is a set of rings for filling, not a region with holes; the
  planar-domain foundation would replace them if a hole-aware footprint is wanted.
- `canPrepareInstrument` in `index.ts` has a second, unreachable `return` (a merge artefact naming
  `data-scores`); this branch only added `dry-bristles` to the first line.
- Real-interface acceptance, layered work in the app and interaction cost are root's to exercise.

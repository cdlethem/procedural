# Sand Deposition (brief 11)

Status: **implemented on branch `w2/sand-deposition`, unreleased. Reviewed from rendered output only;
not yet exercised through the real Studio interface, layered in the app, or reviewed for
responsiveness there.** It builds on the frozen [reference slice](composition-reference-slice.md) and
[structural operators](composition-structural-operators.md) boundary and on the
[gesture scores](composition-gesture-scores.md) fall model. Guide:
`packages/instruments/guides/sand-deposition.md`.

## Artist-facing brief

Sand falls from a moving spline. Control points travel over explicit time; grains are released along
the curve, fall for a random delay and land; their accumulated density is drawn as exposed grains,
isolines of the density, or both. A protected space (ellipse, rectangle or a word's letters) stays
empty; a sparse crisp copy of the generating curve can lie on top. Total deposition is a measure, so
fine and coarse sand of the same amount have the same tone; exposure changes how strongly the sand shows
and can never move it.

## Input contract (F3, recorded control channels)

`ControlSequence` (`composition/control-sequence.ts`): a resolved, deeply frozen value: `id`, `closed`,
`t` (ms, strictly increasing), `controls[keyframe][control] = [x, y]` (canvas units). Limits: 2 to 4,000
keyframes, 2 (open) or 3 (closed) to 64 controls, 10 minutes, coordinates within +-1e6; each failure names
the keyframe and control. `sequenceFingerprint` (64-bit content hash) keys every cache. Instruments persist
only a bundled sequence's id (a select); the direct function API and the typed recipe accept any
`ControlSequenceData` a caller resolved. **Binding a user's own sequence to a saved instrument is future host
work** (an asset field); the library never captures, fetches or decodes.

## Producers and consumers

| Piece | Where | Contract |
|---|---|---|
| `createControlSequence`, `controlSequenceData`, `sequenceFingerprint` | `control-sequence.ts` | Validation, JSON round trip, content hash. |
| `bundledControlSequence(id, seed)` | `control-sequence-samples.ts` | Five deterministic sequences, irregular keyframes; the seed is the take. |
| `curveFamily(sequence, {motion, frame})`, `CurveCursor`, `curveAtTime`, `lengthIntegral` | `spline-family.ts` | The spline sampled over curve and time. Cached (12). |
| `landGrain`, `fallVelocity` | `grains.ts` | The fall model, shared by Gesture Scores' `sandGrains` and `splineDeposit`. |
| `splineDeposit(family, options)` | `deposition.ts` | Grains with mass, ids, seeds, release origin; cached by family and options. |
| `protectedSpace`, `keepOut` | `deposition.ts` | Reserved region built from the existing `resolveSupport`; kept/rejected ledger. |
| `accumulateDensity`, `smoothDensity`, `densityContours` | `grains.ts` | The density field and its isolines (same marching squares and chain assembly as Contour Scores, via the extracted `contourChains`). |
| `exposeGrains`, `depositGrains` | `grains.ts` | The exposure law and the grain consumer. Gesture Scores draws its sand through `depositGrains` (no exposure: identical output). |
| `curvePaths` | `deposition.ts` | The generating curve at anchored times, cut by the protected space (existing `clipToSupport`). |
| `sandDepositionComposition/Products`, `drawSandDeposition`, `prepareSandDeposition` | `deposition.ts` | JSON-compatible recipe, cached producers, drawing through `strokeWith` / `depositGrains`, cooperative preparation. Any consumer can be replaced by an ordinary callback. |
| Definition and controls | `adapters/sand-deposition-instrument.ts` | Parameters, groups, defaults, validation. |

Extracted (not copied): the fall model out of `sandGrains` (`landGrain`), the sand drawing out of Gesture
Scores (`depositGrains`), `contourChains` out of `contourPaths`, `cachedBy` out of `gesture.ts` into
`core.ts`, and `reconstruct` (exported from `recording.ts`). The protected space, curve clipping and text
outlines are the existing `support.ts` machinery. `Site.opacity` (optional, absent is exactly 1) and
`DOT_ALPHA` are the only additions to shared types/materials.

## Frozen semantics

- **Curve family.** Each control's keyframes are reconstructed on one canonical uniform time grid
  (step <= 8 ms up to ~48 s) by the recording's piecewise-cubic Hermite, so the curve depends on the motion,
  not the keyframe density (30 Hz against 200 Hz: < 0.5 canvas units on a 400-unit motion, asserted).
  **Motion** `m`: `p = mean + m (p - mean)` per control about its own time average (0 freezes the average shape).
  **Frame**: similarity about the centre of the bounding box of the unscaled control points over all time, so
  motion never moves the placement. The curve is a uniform Catmull-Rom (open: reflected ends; closed: wrapped)
  resampled at 513 points of equal arc length, so `u` is the fraction of length at every time. Length varies
  in time; `lengthIntegral` is exact for the piecewise-linear length. Typed arrays cannot be frozen; they are
  read-only by type and never touched after publishing.
- **Mass.** `deposit` is mass per canvas unit of curve per second, in area units. `Deposit.mass = deposit x
  lengthIntegral(window)`; the grains' masses sum to it exactly (rescaled, weighted by the curve length at each
  release time, so mass per unit of curve is uniform). `grainMass` is the requested MEAN mass per grain; the
  count is `ceil(deposit x lengthIntegral(0, duration) / grainMass)` indices over the whole sequence. Halving
  it doubles the grains and keeps the mass.
- **Sampling.** Grain `j` leaves at `T frac(vdC2(j) + shift)` (base-2 van der Corput: a prefix is always evenly
  spread, so raising the deposit or lowering the grain mass only ADDS grains), at the arc fraction of an
  independent seeded draw. The window keeps indices whose time falls inside it; survivors keep position, id and
  seed exactly (only their masses are rescaled to the window's integral). Ids `<sequence id>/grain:<j>`; streams
  `componentSeed(seed, id, purpose)` for `arc`, `lag`, `radius`, `around`; the seed also gives the shift and the
  bundled take. Emitter velocity is the material point's own (difference of the enclosing frames).
- **Fall.** `landGrain`: delay `lag * u / 1000` s; position `P + (inherit V + F) delay + scatter`; frame along
  `inherit V + F`. Identical arithmetic to the former inline code (Gesture Scores drawings are pixel-identical).
- **Protected space.** Ellipse (inscribed polygon, chord tolerance 0.2), rectangle, or word outlines (font
  outlines, nonzero fill, counters open). A grain whose landing point is inside is rejected: reported, never
  redeposited; accepted + rejected mass is exactly the deposit's mass. The fall path is not tested.
- **Density.** Bilinear splat of mass onto cell centres; value is mass per canvas unit squared; the sum times
  the cell area is the mass inside the grid at any cell size; grains outside the canvas are reported
  (`outside`). `smoothDensity` scatters and mirrors back, so it conserves mass.
- **Exposure.** `alpha = 1 - exp(-2^stops m / footprint)`; overlapping grains composite to about
  `1 - exp(-2^stops D)` whatever the grain count. A stock dot cannot exceed `DOT_ALPHA` (225/255). A grain
  fainter than 1/16 is drawn at 1/16 with probability `alpha/(1/16)` (stable draw): the expected coverage is
  kept (a bias of a few percent for faint grains, within the 5% the test allows), and raising exposure only adds or strengthens grains. Isolines sit at the densities where
  the same law reaches tones 0.15 to 0.9 (one level: 0.5).
- **Overlay.** Curves at `k x every` ms from the sequence start inside the window (survivors keep ids and points),
  ids `curve:<k>` (`curve:<k>#<n>` for pieces a protected space cuts), `level` the time.
- **Limits.** 60,000 grains in the window (from the time draws, before any grain is built), 2,000,000 indices
  over the sequence, 250,000 field cells, smoothing <= 60 cells, 32 isolines, 400 overlay curves, 2,200 segments
  per isoline (the existing assembler bound), callback budget 400,000 per draw. Each message names the control to
  change; nothing is thinned.
- **Units.** Canvas units, ms (times, lag), speeds per second, option angles degrees, published angles radians,
  mass in area units.

## Controls and groups

Sections in order: **Sequence** (sequence, motion), **Placement** (center X/Y, scale, rotation), **Time window**,
**Deposition** (deposit, grain mass; *Fall*: time, speed, direction, carried motion, grain spread),
**Protected space** (shape, word, center X/Y; proportional *Size*: width, height), **Exposure** (exposure,
material), **Grains** (size), **Isolines** (levels, field cell, smoothing, weight), **Curve overlay** (toggle,
interval, weight). Inline `visibleWhen`: word by `protect` word; the other protected-space controls by `protect`
not none; grain size by `material` grains/both; isoline controls by `material` isolines/both; overlay interval and
weight by `overlay`. The control audit (`tests/helpers/audit-controls.ts sand-deposition`: 31 controls, 1,221
probes) reports zero violations and no proposed further conditions. Slider intervals stay inside the measured safe
region; hard bounds are the semantic ones (field cell >= 1.5, deposit > 0, ...).

## Checks

`tests/composition-sand-deposition.test.ts` (32 tests): sequence validation, freezing and fingerprint;
exactness for collinear controls and arc-length parameter; circle length and closure; motion about the average
with exact expected values; frame similarity; keyframe-density independence; cursor velocity and length integral;
bundled sequences (irregular, seed = different curves); exact mass over grain size and window; equal mass per
unit of curve; even time spread; nesting under deposit/grain mass; window stability; fall vector and delay
statistics; scatter statistics; reproducibility; the exposure law, monotonicity and producer identity; optical
depth independent of grain count and mark size; producer identity across appearance edits and rebuilds across
structural ones; protected rectangle/ellipse/word ledgers; density conservation across cell sizes and bilinear
splits; smoothing symmetry and mirrored mass; isoline loops at the right radius, islands and nesting; overlay
anchoring and cutting; recipe resolution; consumer substitution; preparation and cancellation; failure messages.
Mutations confirmed to fail: window mass not renormalised, exposure ignoring the footprint, rejected mass not
recorded, overlay anchored to the window start, grain times not nested, motion about zero, smoothing dropping
edge mass. Full suite: 302 tests pass.

Gesture Scores identity: 60 fingerprints (12 gesture-scores configurations x 3 seeds including every sand mark,
gate, lag, rate, window and repeats; contour-scores 5 sources; region-quilts; recursive-cells) with
`tests/helpers/draw-fingerprint.ts` before and after the extraction are identical.

## Review record

Rendered with a throwaway SVG surface (defaults at three seeds, all five sequences, isolines, both, still curve,
sparse fragment with overlay, dense 56,000-grain extreme, sideways fall, three protected shapes, combined,
grain-mass 0.5 / 3 at equal tone, Contour Scores / Region Quilts / Motif Ecologies layered in both orders).
Defects found by looking and fixed:

- the first curtain default covered the whole canvas as an even fog: shorter window, more fall, tighter scatter, oval moved into the deposit;
- grains read too faint: larger default grain, +1 stop;
- one deposit slider range hit the grain limit on other sequences (bloom): slider 1 to 12, message names the controls;
- isolines at exposure 0 showed only two fringe levels: default exposure +1, tones follow the same law as the grains;
- fine field cells with faint levels traced single grains and exceeded the chain limit: sliders start at cell 4 and smoothing 4, message also names exposure;
- an overlay id printed `-0`;

Timing (Node, null surface; draw cost in a real p5 canvas is higher): default first preparation 48 ms, redraw
8 ms. Large setting (56,000 grains, both, 9 isolines on 3-unit cells, overlay every 100 ms; about 495,000
calls): first preparation 230 ms; grain size and weights 15 to 29 ms; exposure edit 113 ms (isolines move);
structural edits 150 to 268 ms (window, deposit, motion, protected shape, seed).

## Open concerns and decisions to confirm

- Persisted instruments name only bundled sequences; a captured sequence needs a host asset field.
- The bundled sequences are synthetic.
- Density is drawn as grains and isolines; the composition surface has no image API, so the flame-style pixel
  tone map (`Flame Clouds`) is not reused.
- The protected space rejects rather than redeposits; the fall path is not tested. Sharing one protected region
  between layers needs host-level linking.
- Isolines close along the canvas edge (the field is the 640-unit canvas; mass beyond it is reported, not drawn).
- `canPrepareInstrument` in `index.ts` has a second, unreachable `return` (a `data-scores` line left by a merge);
  only the first is live, so `data-scores` reports not preparable. Not changed here.
- Real-interface acceptance, layered work in the app and interaction cost are root's to exercise.

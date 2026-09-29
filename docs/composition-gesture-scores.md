# Gesture Scores (brief 40)

Status: **implemented on branch `w1/gesture-scores`, unreleased. Reviewed from rendered output
only; not yet exercised through the real Studio interface, layered in the app, or reviewed for
responsiveness there.** It builds on the frozen [reference slice](composition-reference-slice.md)
and [structural operators](composition-structural-operators.md) boundary. Guide:
`packages/instruments/guides/gesture-scores.md`.

## Artist-facing brief

Replay one recorded hand movement, with its timing and pressure, through three techniques at once:
a broad dry bristle brush, sand released on the recording's own clock that falls with a delay, and
glyphs placed along the path. One time window and one smoothing reshape all three, and no material
choice can change the recording or the replay. Sparse dry-brush fragments and dense repeated
rosettes are the same instrument with different settings.

## Input contract (F3, recorded channels)

The library defines a typed, deeply frozen, RESOLVED value and never captures, fetches or decodes.
Instruments persist only a technique id, scalar params and a palette, so the instrument selects a
BUNDLED deterministic recording; the direct function API and the JSON typed descriptor accept any
`RecordingData` a caller resolved. Binding a user's own captured stroke to a saved instrument is
future host work (an asset field in the document).

`Recording` (`composition/recording.ts`): `id`, `t` (ms, strictly increasing, validated), `x`, `y`
(canvas units) and `pressure`, which is either an array in [0, 1] or **`null`**; the key must be
present, so absence is a distinct explicit state and never 0 or 1. Raw samples are copied, frozen and
kept as given. Limits: 2 to 200,000 samples, 10 minutes, coordinates within ±1e6; each failure names
the channel and index. `recordingFingerprint` (64-bit content hash) keys every cache.

## Relation to the recorded-control sampler (Word Echo)

The library already has `signal.sample-recorded-controls` (`sampleRecordedControls` in
`@procedurals/javascript`), which Word Echo calls through `controlsAt`. `Recording` is not a second
incompatible concept for the same thing; the two answer different questions and are deliberately
not merged:

| | `sampleRecordedControls` (Word Echo) | `Recording` / `gestureTrack` |
|---|---|---|
| What it holds | Named scalar channels of derived features (RMS level, accent) on a fixed hop, no geometry | Raw device samples: x, y, optional pressure |
| Timebase | Seconds, non-negative, strictly increasing | Milliseconds, strictly increasing, any start; converted to relative seconds by the adapter |
| Query | One value per mapping at one caller-supplied time | A whole replay: a uniform grid, arc length, direction, speed, stations |
| Between samples | `LINEAR` or `STEP` per mapping, exact on samples | Cubic Hermite on the real timestamps (three-point slopes, monotone for pressure); exact on samples |
| Outside / gaps | Holds the last sample after the end; refuses queries before 0; a gap wider than `maxGap` fails (`TIME_GAP`) | The window is checked against the duration; gaps are interpolated through, never refused |
| Missing data | No optional channels; a mapping names a channel that exists or fails | `pressure: null` is an explicit state resolved by a stated policy |
| Resampling rule | Point query only, no resampling | Fixed grid (at most 4 ms), then time or arc-length stations anchored at the recording start |

Why not one rule. Word Echo's defaults depend on the historical linear/step sampling and its
`maxGap` refusal, and its channels are windowed features rather than a trajectory, so replacing its
rule with Hermite replay would change its drawing, and forcing a recording through `LINEAR` would give
a polygon with corners at every device event (the frequency dependence the brief forbids). The
Word Echo code, its default drawing and the core operation are untouched (no file of either is in this
branch's diff).

What is shared is the value: `recordingControls(recording)` returns the raw samples exactly as the
core sampler's input (`times` in seconds from the start, channels `x`, `y` and only when present
`pressure`). Any core mapping, `LINEAR` or `STEP`, can therefore read a recording, for example to
drive a Word Echo-style level from a gesture's pressure, and a mapping naming an absent pressure
channel fails rather than reading 0. It is one-way and lossless; there is no `recordingFromControls`,
because a control series has no positions and inventing them would be dishonest. The test compares
the two on the same series: identical on every recorded sample, linear between them in the core
versus the replay's curve, and each side's failures (negative time, `TIME_GAP`, absent channel).

## Producers and consumers

| Piece | Where | Contract |
|---|---|---|
| `createRecording`, `recordingData`, `recordingFingerprint`, `recordingControls` | `composition/recording.ts` | Validation, JSON round trip, content hash, the view the core recorded-control sampler reads. |
| `gestureTrack(recording, {smoothing, frame})` | same | Frozen derived replay: reconstruction on one canonical uniform time grid, smoothing, frame, tangents, speed, arc length. Cached (24 entries) by content, smoothing and frame. |
| `echoTrack(track, ...)` | same | Repetition: the same track rotated and moved; shares arc, speed and pressure. |
| `resolvePressure(track, policy)`, `speedPressure` | same | Pressure policy with an explicit fallback; reports which source actually supplied the values. |
| `stations(track, rule, window)`, `countStations` | same | Time or arc-length stations, anchored at the recording start. |
| `bundledRecording(id, seed)`, `bundledRecordingInfo` | `composition/recording-samples.ts` | Five deterministic sample recordings. |
| `gesturePath`, `bristleBand`, `sandGrains`, `gestureSites`, `mapPressure` | `composition/gesture.ts` | Frozen, cached consumers-ready values: a `Path` with per-point channels, hair `Path`s, grain and glyph `Site`s. |
| `gestureScoreComposition`, `gestureScoreProducts`, `drawGestureScore`, `prepareGestureScore` | `composition/gesture-scores.ts` | JSON-compatible descriptor, its producers, drawing through `strokeWith` / `atEach` with `pathMaterial` / `motif`, cooperative preparation. Any consumer can be replaced by an ordinary callback. |
| Definition and controls | `adapters/gesture-scores-instruments.ts` | Parameters, groups, defaults, validation. |

Existing computations reused: `strokeWith`, `atEach`, `pathMaterial` (ink for hairs; ink or stitch
for the optional line, which uses `resamplePolyline2D`), `motif` (sand and glyphs),
`componentSeed`, the composition run budget. Nothing existing was refactored, so no existing
default drawing changed.

## Frozen semantics

- **Reconstruction.** Piecewise-cubic Hermite on the actual timestamps. Positions use the
  second-order three-point slope, zero where a neighbouring secant is exactly zero (an exact rest
  stays still instead of swinging out and back). Pressure uses Fritsch-Butland monotone slopes and
  never leaves its data range. Sampled on one uniform grid per recording, `step = duration / (N-1)`
  with `step <= 4 ms`, at most 150,000 points. Replay depends on the curve and timing, not on the
  event rate.
- **Frequency independence, measured.** The same closed-form curve (400-unit extent, 2.6 s) recorded at
  30 Hz with 45% timestamp jitter, and at 240 Hz: derived positions at the same moments differ by
  at most 0.034 units and lie within 0.04 of the analytic curve; 15 Hz against 120 Hz gives 0.35
  (0.09% of the extent); 60 Hz against 500 Hz 0.003. Path lengths agree to 0.02%. The tests assert 0.1
  units for 30 Hz vs 240 Hz.
- **Smoothing.** Gaussian standard deviation in milliseconds on the grid; odd reflection about the end
  samples for positions (ends exact, straight constant-velocity runs unchanged), even for pressure
  (stays in [0, 1]); radius limited to the recording's span; at most 80 million kernel products.
- **Frame.** Similarity about the centre of the UNSMOOTHED reconstruction's extent (so neither
  smoothing nor the event rate moves the placement): scale, rotation (degrees, positive is clockwise
  on screen), translation to `centerX`/`centerY`. Speed, arc and stations are measured after the frame.
  Ends use second-order one-sided differences for direction and speed.
- **Stations.** Time rule: `k * interval` ms from the recording start. Arc rule: `k * spacing` canvas
  units of path from the start (a rest collapses to one station; the first moment that reaches an arc
  is used). Both are anchored at the recording start, so narrowing the window keeps every remaining
  station's index, time and position. At most 60,000 per rule per repeat.
- **Pressure policy.** `{source: recorded|speed|constant, whenAbsent: speed|constant|reject, level}`.
  Speed pressure is `1/(1+(v/v0)^2)` with `v0` the median speed of the moving part of the whole track
  (a rest is 1, typical speed 0.5, a flick near 0), independent of window and scale. The instrument
  passes `whenAbsent: "speed"`; `gesturePath.pressureSource` and `resolvePressure().source` report what
  was used. `mapPressure(p) = floor + (1 - floor) * p^curve`.
- **Path.** One `Path` (`id` is the track id) with per-point `times`, `arcs` (from the recording start),
  `angles`, `speeds`, `pressure`; points are the window's two ends and the rule's stations between.
- **Bristles.** Hair `k` has a stable lateral offset in (-1, 1) (jittered stratified draw), follows the
  path at `offset * width * mapPressure(p) / 2` plus a closed-form waver in arc length, and touches
  when the mapped pressure reaches `dryness * (0.65 u + 0.35 |offset|) * (0.55 + 0.9 g(arc))` (edge
  hairs lift first; `g` is a per-hair streak in the path's own arc length, so sampling does not change
  the ink load), the stroke has not passed the hair's depletion point (`1 - depletion * (0.15 + 0.85 u)`
  of the track), and the hair has met the paper (a stable share of 36 units of path: ragged entry). On
  the inside of a turn the offset is limited to 90% of the local radius of curvature so hairs bunch
  instead of crossing into a fan; the side is fixed by the path normal, which never flips. Runs of at
  least two stations are published as `Path`s with `tone 0`.
- **Sand.** Grain `j` is released at `j * 1000 / rate` ms (a fixed clock: rests release more per unit
  length), kept when a stable draw is below `(1 - gate) + gate * mapPressure(p)`, and lands after a stable
  delay `lag * u` at `P(t) + (inherit * V(t) + F) * delay + scatter` (`V` hand velocity, `F` fall
  velocity, scatter isotropic normal). Grains released inside the window may land outside it. `tone 1`.
- **Glyphs.** Sites at the rule's stations, offset along the normal `(-ty, tx)` (positive is to the
  right of the direction of travel on screen), angle `follow * heading`, scale
  `1 - sizeFollow + sizeFollow * mapPressure(p)`. `tone 2`.
- **Repetition.** Repeat `i` is the track rotated `i * turn` degrees about the frame centre and moved by
  `i * (dx, dy)`; repeat 0 is the replay itself, later repeats have their own ids and streams.
- **Ids and seeds.** Track `<recording id>` (`sweep:42`) plus `~i` for repeats; path = track id; hairs
  `<track>/hair:<k>@<run start ms>` (a run the window cuts is a new run); grains `<track>/grain:<j>`;
  glyphs `<track>/glyph:t<k>|s<k>`. Seeds are `componentSeed(seed, id, purpose)`. Hair thickness,
  weight, palette, mark kind and size never enter any producer or cache key.
- **The seed is the take.** Every bundled fixed recording is performed differently per seed by a slow
  tempo modulation (rests stay exact) and a smooth drift of up to 22 units; the wandering hand is a
  different curve. Bristles and grains use the seed as well.
- **Bundled recordings.** `sweep` 2.6 s 90 Hz pressure; `spiral` 3.4 s 60 Hz pressure with two exact
  rests; `loops` 3.2 s 120 Hz pressure; `scribble` 4.2 s 30 Hz no pressure; `wander` 3.6 s 75 Hz
  pressure, seeded. Timestamps are jittered up to 45% of a period. Generated by fixed closed-form curves and
  timing profiles; none is a captured performance.
- **Limits.** Hair vertices 600,000 per composition (all repeats together, per path also); grains
  60,000 (checked from the stored values before drawing); stations 60,000; repeats 16; hairs 400;
  callback budget 400,000 per draw. Over a limit the message names the control to change.
- **Units.** Canvas units, milliseconds, speed in units per second, option angles in degrees,
  published angles in radians.

## Controls and groups

Sections in order: **Recording** (recording, smoothing), **Placement** (center X/Y, scale,
rotation), **Time window** (start, length), **Sampling** (sample by, stroke spacing / interval),
**Pressure** (source, constant level, light-touch size, curve), **Repetition** (repeats, step X/Y/turn),
**Bristles** (toggle; proportional *Scale*: brush width and hair weight; hairs, dryness, depletion,
waver), **Line**, **Sand** (*Release*: rate, gating; *Fall*: time, speed, direction, carried motion,
scatter; proportional *Scale*: size and line weight; variation, retention), **Glyphs** (*Spacing*, offset,
follow, pressure size, proportional *Scale*, *Shape*, variation, retention). Placement follows the first
construction section. The window is start plus length (end is `min(1, start + length)`), so no slider
order is invalid.

Inline `visibleWhen`: stroke spacing/interval and glyph spacing/interval by `sampling` (glyphs also by
their mark); constant pressure by `pressureSource`; every bristle control except the toggle by
`bristles`; line weight by `line` ink/stitch, stitch controls by stitch; sand controls except the mark
by `sandMark`, sand line weight by rings/arrow; glyph controls except the mark by `glyphMark`, weight by
rings/rosette/arrow, petals by rosette, opening by rings/rosette. The control audit
(`tests/helpers/audit-controls.ts gesture-scores`: 54 controls, 3,266 probes) reports zero violations
and no proposed further conditions. Left visible: the repeat steps (matter only above one repeat, a
numeric condition) and `sampling`, `pressureSource`, `pressureFloor`, `pressureCurve` (relevant if any of
several consumers is on, a disjunction).

## Checks

`tests/composition-gesture-scores.test.ts` (30 tests): validation and freezing, explicit pressure
absence and fingerprints, timestamp/range failures; constant-velocity reconstruction exact on irregular
timestamps; rests stay still and never swing back; smoothing keeps ends, straight runs, pressure range
and the recording; frame centre/scale/turn with exact expected corners; frequency independence against
the analytic curve (30 Hz vs 240 Hz); window-anchored stations, exact multiples of interval and
spacing; rests crowd time stations and collapse arc stations; pressure policy sources and errors;
`Path` channels; hair strata, lift by pressure and dryness, depletion bound, tight-turn bunching and
untouched wide turns; sand clock, lag proportionality, carried motion, scatter statistics, gate nesting
and rest piles; glyph arc spacing, normal offset, direction blend, pressure size; bundled recordings;
descriptor resolution; descriptor versus ordinary functions operation for operation; callback
substitution; material changes leave every produced object identical; one window reshaping every
consumer coherently with unchanged survivors; repeats; seeds; preparation and cancellation; failures.
Mutations confirmed to fail: stations anchored at the window start, even reflection at the start of the
smoothing, every grain using the full lag, hairs ignoring pressure, absent pressure silently constant.

## Review record

Rendered with a throwaway SVG surface (defaults at three seeds, all five recordings, three wandering
seeds, window fragment, time sampling without smoothing, speed pressure, six repeats, ink line with rings,
sparse dry brush, dense off-canvas repeats, layered with Contour Scores and Region Quilts in both orders).
Defects found by looking and fixed:

- brush read as thin ropes: 60 hairs, heavier weight, wider brush, less waver by default;
- the first sweep was a spike off to one side: replaced by a wide swash filling the canvas;
- seeds changed only bristle noise: the seed is now the take (tempo and drift);
- glyphs vanished inside the dark brush: default offset puts them beside the stroke;
- every hair started at the same point (blunt start): ragged entry;
- hairs crossed into fans inside tight turns: curvature limit on the inside offset (a test found the
  one-sided end tangent lagging, now second-order);
- the frame moved with the event rate (placement used the raw samples' extent): it uses the
  reconstruction's extent;
- reconstruction with monotone slopes flattened extrema (0.7 units at 30 Hz): three-point slopes with
  zero slope only at exact rests (0.04);
- the line drawn in the last palette colour vanished on the brush: it uses palette 1;
- the scribble read as three loops: higher frequencies;
- the offset control's direction was described backwards (positive is to the right on screen).

Timing (Node, null surface, this machine; draw cost in a real p5 canvas is higher): default first
preparation 21 ms; appearance-only edit 0.1 ms; structural edits (smoothing, window, take) 8 to 13 ms.
Large setting (8 repeats, 120 hairs, 500 grains/s, scale 1.4; about 710,000 drawing calls): first
preparation 109 ms; appearance-only edit 8 ms; structural edits 90 to 110 ms (a hair-count edit
re-uses the replay, 91 ms).

## Open concerns and decisions to confirm

- Persisted instruments name only bundled recordings; supplying a captured stroke needs a host asset
  field. The descriptor and functions already accept it.
- The bundled recordings are synthetic. Whether to ship one genuinely captured stroke is a host/content
  decision.
- The instrument's missing-pressure policy is fixed to speed (documented in the control); the library
  API requires the policy explicitly and can reject.
- The brief's fourth consumer, a chemical emitter, is not built: no chemical producer exists in this
  branch. The same producers (`gestureTrack`, stations, sites) are what an emitter would consume.
- One time window and one smoothing apply to all layers by design; per-layer windows are not offered.
- Sand is drawn as marks, not accumulated into a density field (brief 11 owns density/exposure).
- Real-interface acceptance, layered work in the app and interaction cost at large settings are
  root's to exercise.

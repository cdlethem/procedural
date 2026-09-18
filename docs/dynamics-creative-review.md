# Dynamics studies creative brief and review

This record applies [creative quality](creative-quality.md) to the nine external-dynamics
gallery studies integrated at the [main integration checkpoint](../evidence/web/main-integration-checkpoint.json).
It freezes the control model for the revised studies before implementation, records the
exploration in the real interface, and carries the root creative verdict. The studies
remain drafts until this review passes; their technical evidence (second-batch cores,
replay latency, 62 unchanged drawing hashes) is preserved and not re-claimed.

## Audit, 17 September 2026

Rendered from the working checkout at seed 42 (draft images retained under
`.work/handoff/`, `draft-<slug>.png`).

| Study | Reading | Control problem | Verdict |
|---|---|---|---|
| dye-currents | artwork | none | pass |
| guarded-bands | artwork | none | pass |
| lingering-links | woven ring with age-faded links | none | pass |
| flocking-marks | radial trail burst | none material | pass |
| sensing-trails | technical wind map | visible 64x64 grid render; probe distance hidden | revise drawing + one structural control |
| bridge-web | circuit board | rigid straight strands; cross route is a scene toggle | revise |
| neighborhood-growth | sparse wireframe | default ticks barely move; step hidden; large marks inert | revise |
| elastic-loops | angular zigzag | seed bakes kinked rest turns; growth/curl/contact hidden | revise |
| hatched-islands | warm hatched mass | all four controls are toggles; no continuous structural choice | revise |

## Frozen control model

### sensing-trails (`sensor-motor-step-2d`)

What an artist makes: a field of marks steering through a replaceable scalar field, with
the probe reach determining whether motion reads local-twitchy or smooth-arcuate.

| Control | Interval | Default | Meaning |
|---|---|---|---|
| Ticks | 0-80 | 43 | replay depth (unchanged) |
| Field source | upper-right / lower-left | upper-right | replaceable field input (unchanged) |
| Turn gain | -0.1..0.1 | 0.05 | signed right-minus-left response (unchanged) |
| **Reach** | 4-40 | 13 | probe distance; was hardcoded 13 |
| Dot marks | toggle | off | mark substitution (unchanged) |

Drawing change: the field is painted as one continuous soft wash (the 64x64 cell grid is
removed); trails keep their full retained length at a slightly heavier weight. No
computation change. Migration: old `{ticks, field, gain, dotMarks}` gains `reach: 13`.

Reach hard limit 4-40: below 4 the paired probes no longer resolve the authored bumps
(observed: turns become noise); above 40 both probes sit on the same lobe and the signed
response collapses (observed: trails go straight).

### bridge-web (`insert-segment-bridge-2d`)

What an artist makes: a web of selected segments accumulating across an authored strand
graph, with strand waviness, candidate slant and gap rhythm as independent construction
choices.

| Control | Interval | Default | Meaning |
|---|---|---|---|
| Bridges | 0-42 | 42 | replay depth (unchanged) |
| **Strain** | 0-60 | 25 | authored strand waviness amplitude (source geometry; was hardcoded 25/13) |
| **Slant** | -60..60 | 31 | base candidate slant; per-tick oscillation retained as `slant * (1 + 23/31 * sin(tick * 0.53))`. Negative is the former cross route. |
| **Stride** | 1-8 | 5 | gap-selection step; `gap(tick) = (tick * stride) % 6`. Replaces the toggle gap sequences. |
| Candidate guide | toggle | on | shows next proposed segment (unchanged) |

Stride hard limit 1-8: the gap index is modulo 6, so stride only acts through
`gcd(stride, 6)`; 1-8 enumerates every distinct gap subset (all 6, 3, 2 or 1 gap).

Migration: old `{ticks, weave, candidate}` maps to
`{ticks, strain: 25, slant: weave ? -31 : 31, stride: 5, candidate}`. Saved documents
keep their parameter meanings; the gap schedule itself was redesigned (clean period-6
cycle instead of the former double-zero every seventh tick), so old defaults render
slightly differently.

### neighborhood-growth (`relative-neighborhood-pairs-2d`, `threshold-edge-relaxation-2d`)

What an artist makes: an exact local graph guiding synchronous point relaxation, with
threshold and step strength choosing how far the silhouette may move.

| Control | Interval | Default | Meaning |
|---|---|---|---|
| Ticks | 0-36 | **24** | replay depth; old default 8 barely moved |
| Open chain | toggle | off | graph substitution (unchanged) |
| Length threshold | 0-100 | 38 | edges at/below do not move points (unchanged) |
| **Step** | 0-1 | 0.5 | relaxation strength; was hardcoded 0.35 |

`largeMarks` is removed: point radius now reflects graph degree (appearance-only
encoding; teaches which nodes carry the graph). Drawing adds ghost seed points and
displacement spokes (seed to current position) so the accumulated relaxation reads as
motion; the graph, spokes and degree-scaled points use three distinct layer alphas.

The frozen 0-24 / 16 / 0.35 model was superseded during exploration: at 16 ticks and
step 0.35 the accumulated displacement is a few pixels and the spokes cannot be read
against the graph, so the default is 24 ticks at step 0.5 (measured ~10px mean, ~18px
max displacement, clearly visible at 640) with the interval extended to 36 so the
default is not the ceiling.

Migration: old `{ticks, chain, minLength, largeMarks}` maps to
`{ticks, chain, minLength, step: 0.35}`; old `ticks` values (<=24) are preserved inside
the new interval, new documents use 24.

### neighborhood-growth growth extension (frozen 18 September 2026)

The Design-family decision delivers RNG evolution as this study; the missing piece is
the Differential Lattice node-insertion coupling ("attraction/repulsion and node
insertion are coupled"). Per the capability decision it composes existing operations:
a deterministic proposal pool plus an explicit old-density filter feed the same
per-tick exact `spatial.relative-neighborhood-pairs-2d` requery and
`motion.threshold-edge-relaxation-2d` relaxation. No new operation is admitted and no
source-specific growth threshold is inferred.

What an artist makes: a growing relative-neighborhood lattice. Each tick the web first
relaxes along its current exact graph, then a fixed 196-point jittered-grid proposal
pool is scanned in a fixed deterministic order and candidates whose count of existing
points within the 70px density radius falls inside an explicit integer interval are
appended; the graph is requeried next tick, so new nodes immediately structure the web.
Candidates are all judged against the same old (relaxed) state, so candidate-candidate
crowding is not prevented; that choice is stated, and minimum-spaced insertion is a
separate placement rule, not an implied property.

| Control | Interval | Default | Meaning |
|---|---|---|---|
| Ticks | 0-36 | 24 | replay depth (unchanged) |
| Open chain | toggle | off | graph substitution (unchanged; the chain now follows the growing point set) |
| Length threshold | 0-100 | 38 | edges at/below do not move points (unchanged) |
| Step | 0-1 | 0.5 | relaxation strength (unchanged) |
| **Insert** | 0-3 | 1 | new nodes appended per tick from the proposal pool; 0 keeps the point set fixed (the former study) |
| **Min neighbors** | 0-3 | 1 | fewest existing points within the density radius a candidate needs |
| **Max neighbors** | 1-7 | 3 | most existing points within the density radius a candidate may have |

Schedule: relax, then insert into the new state; new links first contribute next tick.
The supplied chain in Open-chain mode is the adjacent-index chain over the current
point set, so it follows growth; with Insert 0 it is the fixed 25 pairs of the former
study and behavior is unchanged.

Drawing: seed points keep ghost seeds and displacement spokes; inserted nodes use the
pale palette slot (index 4) so new material reads apart from the original web. Point
radius still encodes graph degree for both populations.

Hard limits, measured on this machine (node, p5 2.3.2 package sources):

- Point cap 96 total (26 seeds + at most 70 insertions): the exact
  relative-neighborhood query is O(N^3); measured per-query cost is 1.4ms at N=26,
  2.8ms at N=50, 7.1ms at N=96, 11.0ms at N=134. The cap keeps the 36-tick combined
  maximum (Insert 3) around 0.4s instead of 2.3s.
- Judgment cap 48 candidates per tick: a radius sweep for one candidate measures
  0.09-0.27ms; 48 judgments bound per-tick insertion below ~10ms. Deferred candidates
  are re-judged as the scan wraps, so a sparse region qualifies once the web reaches
  it.
- Min neighbors 0-3 / Max neighbors 1-7: measured old-neighbor counts within 70px
  span 0-7 across the canvas around the seed ring (ring-local density ~4). The two
  bounds are independent regimes: Min 0 starts growth in empty space (multiple foci);
  Min 1 propagates from the web only. Low Max keeps growth in sparse regions; high Max
  clusters it near existing points. Min above Max accepts no candidate (stated, not
  clamped).
- Insert 0-3: with the point cap, Insert 3 over 36 ticks reaches the cap at tick 24
  and the remaining ticks relax the full web; the combined maximum is runnable.

What stays hardcoded, and why: the jittered-grid pool (authored deterministic source
geometry, like the seed spiral; its fixed order breaks the row-major bias without an
RNG); the 70px density radius (a coupled secondary scale; the interval, not the
radius, chooses where growth happens); the judgment and point caps (measured
execution bounds above).

Migration: saved works in the pre-revision shape `{ticks, chain, minLength,
largeMarks}` and the post-revision shape `{ticks, chain, minLength, step}` migrate
with Insert 0, preserving their static 26-point content; new documents use the Insert
1 default.

Exploration probes: default vs Insert 0 (the former study); Min neighbors 0 vs 1;
Max neighbors 1 vs 7; Insert 3; combined maximum (ticks 36, Insert 3, Max neighbors
7); Open chain on with growth; a saved work in each old shape loads through the
migration; reset and reload restore the default; export works from the extended study.

The native example mirrors the same mechanism as editable constants (Insert 1,
Min 1, Max 3, radius 70, same pool) with a Growth toggle.

### elastic-loops (`elastic-curve-grow-step-2d`)

What an artist makes: three growing strands whose material rest lengths, bend targets,
wind and mutual contact are independently directed.

| Control | Interval | Default | Meaning |
|---|---|---|---|
| Ticks | 0-36 | 36 | replay depth (unchanged) |
| **Growth** | 0-0.04 | 0.018 | rest-length growth rate; was hardcoded |
| **Curl** | -0.15..0.15 | 0.09 | signed bend-target rate; sign replaces Reverse curl |
| Wind | -2..2 | 0 | horizontal external acceleration (unchanged) |
| **Range** | 0-120 | 55 | distance within which nonincident segments push apart |
| **Strength** | 0-24 | 18 | force applied inside the avoidance range |
| Structure | toggle | off | reveals retained nodes (unchanged) |

Seed: the accepted native sketch geometry is used unchanged (three 10-node strands,
49px segments, x = 145 + 175c + 27sin(0.72i + 0.85c)). The earlier 14-node seed change
was reverted: with the long-range contact regime it had been paired with, every
configuration baked persistent zigzag kinks, because nodes displace ~30px before the
local gap exits the 160px force radius and the weak stretch stiffness (0.03) locks the
V-shape in place.

Contact model: the frozen single `contact` (0-80, strength fixed 18) is split into the
two axes the operation actually exposes. Range 0-120 sweeps off / collision-only
(55, the native value) / early avoidance (120, strands bow into S-curves before any
touch); strength 0-24 scales the push at the chosen range (0 disables it). The
default 55/18 reproduces the accepted native sketch exactly.

Hard limits, confirmed during exploration with the 36-tick replay at the 160-node /
160-edge caps: growth 0-0.04, because 0.06 combined with curl and wind saturates the
caps (measured OUTPUT_LIMIT; stretched edges re-bisect every tick). Curl -0.15..0.15,
because 0.3 fails in both signs (measured OUTPUT_LIMIT forward, STEP_BLOCKED reverse,
and OUTPUT_LIMIT at 36 ticks with the default growth). Range/strength 0-120 / 0-24:
the joint maximum is runnable (147 nodes) and each single-control extreme is runnable.

Migration: old `{ticks, reverseCurl, windX, structure}` maps to
`{ticks, growth: 0.018, curl: reverseCurl ? -0.09 : 0.09, windX, range: 55,
strength: 18, structure}`.

### hatched-islands (`hatch-region-lines-2d`)

What an artist makes: two independent hatch fields clipped to a region with holes, with
spacing and direction of each field as continuous choices.

| Control | Interval | Default | Meaning |
|---|---|---|---|
| **Spacing** | 6-60 | 24 | primary field line spacing; was [24,40]/[14,27] pairs |
| **Cross** | 6-80 | 40 | secondary field line spacing |
| **Rotation** | 0-360 | 16 | primary field direction in degrees; direction vectors are normalized by the operation |
| **Twist** | -180..180 | 110 | secondary direction relative to primary |
| **Region** | island-a / island-b | island-a | replaces Other island toggle (source substitution) |
| Outline | toggle | on | boundary drawing (unchanged) |

Direction math: `dir1 = (cos r, sin r)`, `dir2 = (cos(r + t), sin(r + t))`. Defaults
16/110 reproduce the former default scene (measured 15.7/109.9) and region `island-b`
with rotation 71 / twist -85 reproduces the former rotated scene.

Spacing/Cross hard limits 6-80: below 6 fragments alias (visual mush); above 80 fewer
than seven lines cross the widest island at 720 scale and the field stops reading as
hatching. Phase stays hardcoded (7/13): field alignment is a subtle secondary effect.

Migration: old `{angle, dense, transfer, outline}` maps to
`{spacing: dense ? 14 : 24, cross: dense ? 27 : 40, rotation: angle ? 71 : 16,
twist: angle ? -85 : 110, region: transfer ? "island-b" : "island-a", outline}`.

### Unchanged studies

dye-currents, guarded-bands, lingering-links and flocking-marks pass the audit with no
schema or drawing change. guarded-bands keeps its crossing-path scene substitution: the
operation's candidate input is a legitimate replaceable source, and the study reads as
artwork at its default.

## What stays hardcoded, and why

- Authored initial geometry in all nine (strands, islands, seed points, populations) is
  example input to the operations, not a control surface. The two hatched islands and the
  two sensing fields are named source substitutions.
- bridge-web candidate oscillation ratio 23/31: gives each bridge a distinct slant; the
  artist chooses the base slant.
- hatched-islands phase 7/13: a coupled secondary effect whose independent exposure
  would add count without a distinct outcome.
- flocking cohesion 0.012 / alignment 0.08: contract parameters; the study exposes
  separation and graph substitution.
- neighborhood-growth seed spiral: the exact local graph is the mechanism; the seed is
  the authored input.

## Exploration probes (acceptance configurations)

Each revised study must show substantially different outcomes for:

- sensing-trails: reach 4 vs reach 40; gain -0.1 vs +0.1.
- bridge-web: strain 0 vs strain 60; stride 2 vs stride 5; slant -31.
- neighborhood-growth: step 1 vs default 0.5; length threshold 0 vs 100; chain on; ticks 24.
- elastic-loops: growth 0; curl -0.15; wind 2; range 0 vs 120; strength 0; combined
  maximum (growth 0.04, curl 0.15, wind 2, range 120, strength 24) remains runnable.
- hatched-islands: spacing 8 vs 60; twist 0 vs 110 vs -85; region island-b.

Plus: a saved-work with the old parameter shape of each revised study must load through
the migration and render its intended content; reset and reload must restore the
default; export must work from the revised studies.

## Review outcome, 18 September 2026

Explored in the real web interface (seed 42, 640px canvas; captures under
`.work/handoff/dynamics-revised/`, registered in
[visual-review.json](visual-review.json) as `dynamics-web-quality-draft-20260918`).

| Study | Verdict | Evidence |
|---|---|---|
| sensing-trails | pass | soft-wash field; reach 4 vs 40 and gain sign produce visibly distinct trail character |
| bridge-web | pass | strain 0/60, stride 2, and slant -31 give sparse, dense and cross-route webs from the same strands |
| neighborhood-growth | pass | default now reads as displacement (ghost seeds + spokes); step 1 stretches spokes, threshold 100 freezes the ring, chain starbursts; the node-insertion extension adds insert 0–3, min-neighbors 0–3 and max-neighbors 1–7, spanning the static web (insert 0, 52 marks) to the dense fill (insert 3, 122 marks), with min-neighbors 0 and max-neighbors 1/7 giving visibly distinct candidate graphs and the combined hard limits remaining runnable (122 marks) |
| elastic-loops | pass | native-regime strands grow, curl and avoid without the former zigzag lock-in; range 0/120 and strength 0 give straight vs S-bowed strands, reverse curl flips the braid, structure reveals the retained splits |
| hatched-islands | pass | spacing/cross/rotation/twist span dense crosshatch to sparse parallel bands; region substitutes the filled shape |
| dye-currents, guarded-bands, lingering-links, flocking-marks | pass | unchanged drafts reviewed; each exposes its mechanism with meaningful controls at an attractive default |

All nine studies: deterministic cached replay, per-control geometry changes and the
combined upper bounds verified by the adapter test suite (now 218 tests, including the
preparation suite); all 106 gallery techniques render without error (`capture-previews`
report). Saved-work migration for the revised shapes is covered by the studio-v3
document tests; reset/reload and export were exercised in the exploration above.

## Responsive preparation, 18 September 2026

The audit step for "slow interaction" required the slow cold replays to stop blocking the
page. The four studies whose models are replayed step chains (bridge-web,
neighborhood-growth, elastic-loops, dye-currents) are now prepared cooperatively before
each draw: the same step chain runs across macrotasks (one `setTimeout(0)` yield per
step), storing the same resumable step snapshots the synchronous path uses, so the
following synchronous draw is a cache hit. A newer document cancels the in-flight
preparation between steps; the partial snapshots stay resumable and the last successful
image is never touched. The remaining five studies compute their model in a single
bounded pass and are drawn synchronously as before.

Measured in the real web interface (seed 42, headless Chromium, software GL; script
`.work/dynamics-responsiveness.mjs`, run under the shared render lease):

| Study | Cold display | Structural edit 1 | Structural edit 2 | Opacity |
|---|---|---|---|---|
| dye-currents | 1.1s | 0.05s | 0.03s | 0.01s |
| guarded-bands | 0.3s | 0.20s | 0.14s | 0.01s |
| lingering-links | 0.15s | 0.007s | 0.006s | 0.006s |
| flocking-marks | 0.11s | 0.01s | 0.009s | 0.006s |
| sensing-trails | 0.16s | 0.011s | 0.009s | 0.01s |
| bridge-web | 5.7s | 0.03s | 0.007s | 0.006s |
| neighborhood-growth | 0.2s | 0.012s | 0.01s | 0.007s |
| elastic-loops | 9.0s | 0.17s | 0.02s | 0.01s |
| hatched-islands | 0.18s | 0.11s | 0.18s | 0.008s |

The two slow cold displays (bridge-web 5.7s, elastic-loops 9.0s) are the full default
replays; during them the page shows the loading state and the main thread keeps
responding. The worst-case edit — a cold-cache key change at full ticks (bridge-web
strain at 42 bridges, no prior warm-up) — completed in 1.0s with a 50ms page heartbeat
uninterrupted (20 beats). Typical edits extend an already-warmed chain and respond in
under 0.2s across all nine studies.

Unit evidence: `tests/external-dynamics-preparation.test.ts` checks, for each
preparable study, that a prepared draw equals an independent cold-cache draw in a fresh
process (separate module instance), that the post-preparation draw is a cache hit, and
that a preparation cancelled after one step leaves the synchronous draw correct.

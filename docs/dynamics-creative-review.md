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
| neighborhood-growth | pass | default now reads as displacement (ghost seeds + spokes); step 1 stretches spokes, threshold 100 freezes the ring, chain starbursts |
| elastic-loops | pass | native-regime strands grow, curl and avoid without the former zigzag lock-in; range 0/120 and strength 0 give straight vs S-bowed strands, reverse curl flips the braid, structure reveals the retained splits |
| hatched-islands | pass | spacing/cross/rotation/twist span dense crosshatch to sparse parallel bands; region substitutes the filled shape |
| dye-currents, guarded-bands, lingering-links, flocking-marks | pass | unchanged drafts reviewed; each exposes its mechanism with meaningful controls at an attractive default |

All nine studies: deterministic cached replay, per-control geometry changes and the
combined upper bounds verified by the adapter test suite (208 tests); all 106 gallery
techniques render without error (`capture-previews` report). Saved-work migration for
the five revised shapes, reset/reload and export remain separate release checks.

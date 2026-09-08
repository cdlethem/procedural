# CP12 noise-band evidence brief

**Scope.** This is a bounded evidence review for the `venas` noise-band walker. It does
not propose an API, admit an operation, or claim a newly recreatable sketch. Existing
package operations may provide ordinary noise-heading drawing ideas, but no current
operation supplies `venas`' proposal acceptance against a walker's starting noise value.

## Exact identity

The note is `survey/out/2018/Generativos/venas/notes.md`, read from the checked-in snapshot.
The PDE is `git show HEAD:2018/Generativos/venas/venas.pde` from pinned source revision
`69bdd8513e4482a5e6018e36887d4bc208660eb5`.

| item | SHA-256 / ledger state |
| --- | --- |
| note | `0ac9dbed8216643e357b5da6c8078d891d3505949409029f75e689a7f4658f2b` |
| pinned PDE | `0379c0d0853af3908bf96a5ed72f1a3bf0830292b24c8316a731cab1ef8091f4` |
| candidate `2018/Generativos/venas#0` | `traceNoiseContours(scale, offset, tolerance, walkers, maxSteps, palette) -> void` |
| candidate evidence | `f7fcca26b72ce6fbc532247d2b6e4df6c3b767743f8407d190ca251e04b0a94d` |
| current disposition | `review_required`, `unreviewed`, no adjudicated cluster |

## Source computation

`generate()` makes 1,000 walkers. Each starts at a random `(x,y)`, samples `val` at that
point, and chooses a random `dir` (`venas.pde:27-32`). It then performs exactly 10,000
**attempts**, not successful moves, per walker (`33`). Thus the nominal proposal count is
10,000,000. Each attempt first computes `ndir = dir + random(random(-HALF_PI),
random(HALF_PI))`, then its one-pixel candidate and `nv` (`34-37`). The two nested bound
draws occur left to right. The strict acceptance test is `abs(nv-val) < 0.002` (`39`): on
success it draws the segment and updates position, then sets `dir = ndir` (`40-43`).

The separate `dir += random(-0.1, 0.1)` occurs before that test on **every** attempt (`38`).
On rejection, position stays unchanged and this jitter is the only heading update. On
acceptance, assigning `dir = ndir` overwrites the jitter rather than accumulating it.
There is no retry limit, early stop, or boundary rejection. A walker can leave the canvas;
out-of-canvas positions are still queried and proposed. Accepted-step count is not present
in any checked-in result, so it cannot be reported from this evidence. The candidate is a
direct drawing helper (`void`), not a retained path output. A reusable retained form would
need to retain accepted vertices/segments while admitting up to ten million attempts; the
source gives no accepted-count, memory, or work policy.

The pinned PDE does not call `randomSeed(seed)` or `noiseSeed(seed)`. Its global `seed`
initializer and key handler therefore do not, by themselves, establish the random/noise
state used by `generate()`. The RNG order is: `det`, `des`, each start, `val`, heading,
per-walker colour, then per-attempt nested proposal draws and unconditional heading-jitter
draw. This source fact limits any seed-only reproduction claim despite the survey's
deterministic label.

## Existing measurements and limits

The five checked-in variants below are whole-scene raster measurements at the survey seed;
each path is an existing artifact, not a new experiment.

| result path | substitution | mean / changed fraction | recorded effect |
| --- | --- | --- | --- |
| `survey/out/2018/Generativos/venas/variants/det_0.004/result.json` | `det` random upper bound `0.001`→`0.004` | `.2451 / .836` | large; finer, denser bands |
| `survey/out/2018/Generativos/venas/variants/tolerance_0.008/result.json` | tolerance `.002`→`.008` | `.2254 / .850` | large; thick, fuzzy bands |
| `survey/out/2018/Generativos/venas/variants/walkers_250/result.json` | walkers `1000`→`250` | `.2029 / .672` | large; sparse bands |
| `survey/out/2018/Generativos/venas/variants/alpha_200/result.json` | alpha `90`→`200` | `.0650 / .253` | moderate; same structure, more opaque |
| `survey/out/2018/Generativos/venas/variants/steps_2500/result.json` | attempts `10000`→`2500` | `.2403 / .816` | large; broken, speckled strokes |

The tolerance and attempt-count controls show that acceptance density and available work
matter artistically, but the measurements include noise state, colour, alpha and direct
rendering. They establish no portable tolerance, scale, count, accepted-step, or memory
range. `venas` is the only exact sketch newly motivated by this candidate; it is not newly
recreatable by the current package because the band-acceptance computation remains missing.

## Computation-level neighbours

These three exact candidates are in the provisional `path.flow-trace` merge, but their
algorithms are noise-heading integration and therefore do not establish band acceptance.
Their provisional ledger status is not package implementation or source reproduction.

| candidate | source / candidate evidence | current state | decisive distinction |
| --- | --- | --- | --- |
| `2018/Generativos/giragira#1`, `noiseWalk(x, y, steps, detail, offset, scaleMul, alpha)` | PDE `5d700857e8b1be0e59d856fae698716ccef3ddec5c62d0fb808354b8f19c57dd`; evidence `3bb6b772641aa25f0b58aeb1bebcfcaabad81f2367e43d7ca251d5760e7c619a` | `merge`, `reviewed_provisional`, `path.flow-trace` | Always advances by `cos/sin(noise(...)*TAU*20)`; no candidate test or heading state. |
| `2018/Generativos/salchis#0`, `noiseWalk(x, y, steps, stepLen, noiseScale, noiseOffset) -> PVector[]` | PDE `b8e67822c8f968947b06700a49c36ad362e7fb4855bacb3d3022d6435a640e18`; evidence `51e6b78aca2c3d4301208c8694154ee08b38ea868ad91ad0de7151286574e7d8` | `merge`, `reviewed_provisional`, `path.flow-trace` | Samples a noise angle, emits the current point, and always moves; no iso-level or rejection. |
| `2018/Generativos/oleone#0`, `noiseWalk(x, y, steps, detail, offset, amplitude, startAngle) -> vertices` | PDE `f9c5175173e0c7d6039277256d333328f26341025f633baba8cd86f767e10308`; evidence `dbb84d71af5e800732320f4231081f0dcc39fc19ad3a8788dd9d2f17a99af192` | `merge`, `reviewed_provisional`, `path.flow-trace` | Blends an initial ring-tangent heading into a noise-derived heading and always advances. |

The names and shared “noise walk” descriptions do not make these equivalent to `venas`.
Ordinary drawing/layout glue could recreate their surrounding compositions only after an
appropriate path operation exists; their distinct source algorithms remain unimplemented
as exact package operations. Root must decide whether `venas`' acceptance loop is valuable
enough to carry its proposal, heading, boundary, RNG, and retained-output burden.

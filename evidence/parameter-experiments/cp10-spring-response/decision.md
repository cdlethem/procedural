# CP10 spring-response parameter decision

Root retains **spring strength** and **velocity retention** as separate candidate
controls for the proposed motion operation. No recommended default or continuous
encouraged range is established. Hard numeric domains and error behavior remain
contract work. This decision completes the registered parameter investigation,
not operation admission, implementation, or artist-workflow acceptance.

## What ran

Seven registered processes completed without stderr: one authored baseline and six
single-coefficient variants. All used the same nine sites, target displacement,
return-to-spawn policy, remote pointer, 640×640 JAVA2D canvas, density1 and drawing.
Processing4.5.6 officially preprocessed the upstream Point body at revision
69bdd8513e4482a5e6018e36887d4bc208660eb5. The sole body substitution replaced its
literal spring multiplier with an outer harness field; construction's sampled
decay was explicitly overridden with each case's fixed retention. Original text
and MIT notice are retained under the ignored build directory.

The authored baseline uses strength0.025 and retention0.7. These are experiment
settings, not inferred defaults. At tick0 each target is displaced100px right.
Before every force update it moves4% toward its spawn; no pointer force applies.
The native probe checks the exact source-float scalar update at every step and
records all121 states for all9sites. It captures ticks0,1,10,30,60,120:42frames,
31distinct PNG byte hashes. Root directly inspected all31distinct frames; every
other frame is byte-identical to the inspected tick0 baseline.

The [registered brief](registered-experiment.json) preserves the exact pre-render
input. [Results](results.json) record every frame's normalized RGB MAE and changed-
pixel fraction. The compiled source, class/runtime hashes, commands and full state
records remain under `.work/parameter-experiments/cp10-spring-response-build` and
`.work/parameter-experiments/cp10-spring-response`. All7render attempts were consumed
successfully; do not rerun this investigation.

## State and visual findings

The table describes the first site, initially at x96. Values are observations of
this Processing-float diagnostic and this target-return sequence.

| Case | Strength | Retention | Peak rightward displacement | Peak tick | First motion reversal | x at tick120 |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 0.025 | 0.7 | 54.356 | 18 | 19 | 97.263 |
| No spring | 0 | 0.7 | 0 | 0 | none | 96 |
| Half spring | 0.0125 | 0.7 | 38.611 | 26 | 27 | 99.111 |
| Double spring | 0.05 | 0.7 | 72.162 | 12 | 13 | 96.914 |
| No retained velocity | 0.025 | 0 | 27.853 | 31 | 32 | 102.475 |
| Higher retention | 0.025 | 0.9 | 91.143 | 16 | 17 | 96.619 |
| Full retention | 0.025 | 1 | 139.447 | 17 | 18 | 12.038 |

Baseline images show a modest rightward trace followed by a return near the spawn
rings. Half strength produces a shorter excursion and later reversal; double
strength produces a longer trace and earlier return. These are clearly different
from simply changing a mark size or palette. Zero strength leaves the initial
zero-velocity sites stationary throughout, confirming that displaced targets alone
do not cause motion when their force contribution is disabled.

Zero retention produces a shorter, slower excursion with no retained velocity.
The sites nevertheless move each step: acceleration changes velocity, that velocity
advances position, and damping then discards it. Calling retention0 “frozen motion”
would be wrong. Higher retention produces a longer trace and five step-direction
reversals by tick120, versus one for the baseline. Its inspected snapshots show
larger displacement and a return near spawn; the full state record reveals the
intermediate reversals that sparse snapshots alone would miss.

Full retention produces persistent, broad oscillation: at tick30 the sites are left
of their spawn rings, at60 they are well to the right, and at120 they are far left.
It has six recorded direction reversals. Traces from neighbouring sites overlap;
the first site's drawn velocity vector reaches beyond the left canvas edge at120.
This is a useful boundary diagnostic, not an encouraged setting for this layout.
It is not deemed mathematically invalid merely because it does not settle.

Whole-canvas pixel changes are small because the marks occupy little area. At
captured tick30, changed fractions range from about0.00459 (half spring) to0.01336
(full retention). Those numbers do not negate the visible and recorded differences
in trajectory. No survey-wide none/subtle threshold was applied to this sparse
motion diagnostic, and no threshold was loosened after rendering.

## Consequences for the public design

Both coefficients earn separate exposure for further contract design: the controlled
variants demonstrate different temporal effects, with all other inputs fixed. Use
names tied to the recurrence. Larger retention means *less* velocity discarded;
calling it an amount of damping would reverse the direction of the control.

Do not infer a universal monotonic relationship from this small sweep. Changing
strength and retention can interact, and the source's moving target adds another
state policy. The three nonzero tested strengths do not establish every value
between0.0125 and0.05 as useful, nor do0/0.7/0.9/1 establish an encouraged retention
interval. No default is approved. Example choices must be described as authored.

This source uses binary32 Processing arithmetic. A proposed binary64 portable core
will need its own exact contract/fixtures and native workflow evidence; these
images cannot attest to a future implementation. Target-return lerp, pointer radius
and input timing were held fixed and have not earned new public controls through
this experiment. Keep those policies visible in the example.

The motivating report remains
[araniaaas](../../../survey/out/2018/Generativos/araniaaas/notes.md). Its existing
variants concern placement, colour and web geometry, not these coefficients.
The [source audit](../../../design/capabilities/physics-evidence-audit.md) and
[source-state investigation](../../investigations/cp10-source-motion.json) explain
why autonomous drift and continuously recomputed Delaunay claims were rejected.

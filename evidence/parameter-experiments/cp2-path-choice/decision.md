# CP2 carrier and retained-path decision

Root and Sol accept the existing named gradient field as the first CP2 carrier for
contract work. All four preregistered images rendered successfully, without stderr, and
both reviewers inspected every image. The four-attempt budget is consumed and terminal;
no follow-up image is authorized by this plan. Generated evidence is in `result.json`.

## Observed result

| Case | Root's direct observation | Evidence |
|---|---|---|
| trace | Thin continuous arcs, curls and reversals; several trajectories converge or leave the canvas. Movement is clearly different from independent fixed-position marks. | 48,000 segments; movement SHA `c3d69d4370b3ab0378c64c2097a214d43ed401959095ef82dde5a50e9187671c`. |
| marks | Short perpendicular lines make coherent curved bands following the same trajectories. Their regular spacing is visible. | 12,000 marks; identical retained movement; 49,051 pixels differ from trace. |
| long-marks | Bands visibly widen and occupy more ground while keeping their centerlines. | Same movement, mark indices and colour hash; total length 12→24 changes 88,062 pixels versus marks (21.50%). |
| finer-field | Tighter turns, loops and more coverage, with conspicuous long horizontal runs near y 400 and y 600. | Recomputed movement SHA `99d9da14a830f12c8c37c2e7f09dae5750a233ccd34e0ad869d132ade19928b8`; 124,194 pixels differ from marks (30.32%). |

The independent Sol review reaches the same narrow conclusion: the base configuration
already supplies readable wandering motion and reusable perpendicular marks. The finer
case does not support isotropy, artifact-free flow, a monotonic “more organic” control or
simplex equivalence. Keep that limitation visible when choosing the final working example.
Canvas exit and convergence are not clipping, collision or spacing guarantees.

A preserved post-render Python diagnostic (`tools/diagnostics/cp2/inspect-alignment.py`,
`evidence/investigations/cp2-field-alignment.json`) finds six of 24 paths with more than 100
successive nearly horizontal steps under its stated descriptive criterion. For example,
the path starting at (60,400) remains exactly on y 400 with heading 0 for 851 steps. Another
starting at (164,240) approaches y 400 before a long nearly horizontal run. Thus the visible
straight sections are present in the calculated movement, not merely an image artifact.
This diagnostic is not another render, a portable tolerance, or proof that one field-offset
edit fixes the behavior. That would need its own bounded evaluation.

## Verified reuse and cost

Pure checks prove the 2000-step path is the exact same-target prefix of 2001 steps, changing
step distance changes the next queried coordinates, angleScale 0 yields constant heading,
and recolouring retained marks makes zero field queries while preserving movement and
mark geometry. The source uses the transformed evolving position; a future public fixture
must directly catch an implementation that repeatedly samples the initial position.
All rendered cases match their checked model/geometry/colour/count metadata and preserve
pre/post drawing hashes. All six pairwise RGB comparisons are retained without a retroactive
pass threshold. These command hashes describe private binary64 segment construction;
they are not a cross-renderer exact-pixel claim.

Packed raw storage is 48,016 bytes for one 2000-step path and 384,016 bytes for 16000 steps.
This pinned JDK's one-path allocation measurement is 48,072 and 384,072 bytes respectively,
with field setup and checksum outside the timed region. The 24×2000 example retains
1,152,384 raw bytes. These observations justify the retained first route; they do not
measure Android memory or guarantee runtime on other devices.

## Parameters and scope

Retain explicit field mapping, step count/distance, heading mapping and independent mark
extent in the capability design. Report 12 and 24 as tested example mark lengths and .002
and .01 as tested field scales under this exact configuration. Neither pair establishes a
continuous encouraged interval or public default. Step distance .4 is a design-test setting,
not an inferred source-faithful ciserp velocity or a universally useful value. Existing
notes separately describe mantel's 1px advancement and natalata's 0.4×scale advancement;
these justify explicit distance semantics, not a common recommended range.

Proceed with the complete packed tracer contract. Keep signed simplex, joined strokes,
branch topology, envelopes, dots and animated agents outside this admission with explicit
remainder accounting. This private experiment does not complete the public I2 example,
four-target validation, artist usability testing or source reproduction. The architecture
and operation proposal retain those requirements.

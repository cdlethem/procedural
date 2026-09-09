# CP19 investigation: localized geometry warps

Status: root admits summed radial pull for contract/implementation after the private study.
Java 0.21 remains the accepted
21-operation baseline. Root owns boundary and acceptance; ports and Sol remain paused.

## Artist task

Place influence centers to bend a retained grid, then change their reach or falloff without
rewriting the deformation algorithm. Reuse the same transform on sampled closed contours.
Grid/curve construction, sampling resolution, colors and drawing stay independently editable.
RasterRemap2D samples pixels from supplied coordinates; it does not compute this coordinate
field. A scalar noise field likewise does not supply localized radial influence composition.

## Decisive source reading

Root read the checked-in notes and pinned source at
`69bdd8513e4482a5e6018e36887d4bc208660eb5` using git show:

| source | PDE SHA256 | actual computation |
|---|---|---|
| 2018/Generativos/curvespace/curvespace.pde | b379b238cc23184c9836d3eb008253ce6bbfd8b75642c531d09130f697df7e91 | Each center is evaluated at the original input; radial pull contributions are summed. |
| 2020/generative/01_04/curves_str/curves_str.pde | 7130e86c675194fc50e1843c619aa76d576a6538d37df81820f56b60ee0cf79c | Sequential outward pushes evaluate the already modified position, with distance-scaled falloff and per-query weight. |
| 2019/generativos/culin/culin.pde | 8292304559eef883e3134a8945ddba772e508b2cc31aad8d0104475e457ee390 | Sequential inward movement consumes separate random lerp factors for x and y at each active center. |

These are not interchangeable implementations. The culin note's nearest-attractor wording
is contradicted by its loop over all centers. Curves_str candidate-looking rows occur under
parameters; no normalized candidate identity is invented for them. Neither neighbor is
merged or rejected by this investigation.

Curvespace#0 is an actual candidate (`attractorWarp`), note SHA256
6bad58b922c2ebb38ffd2aecec420f7aca50b053224eac9cad007fc06661286a,
candidate evidence SHA256 1be8f728c80a61ed1af69b1a7a5e17f9970e221286e29e74a42fbe3962f7cb21.
Its source computes inward displacement magnitude r*(1-(d/r)^p) for d<r. At the exact
center its atan2(0,0) convention selects positive x despite the direction being undefined.
The nonzero limiting magnitude also makes the field discontinuous there. This is not an
invertible warp or topology-preserving deformation, and calling it smooth would mislead.
The report's parameter substitutions have no measured change scores. Source literals are
not recommended ranges.

## Bounded deliverables and stopping conditions

1. Luna retrieves exact identities and computational neighbors (completed; root checked
   decisive sources). No full-corpus screen or candidate-count objective.
2. Terra implements a private JAVA2D study under tools/diagnostics/cp19 using the existing
   render configuration hook. Four configurations are predeclared in
   evidence/parameter-experiments/cp19-radial-warp/experiment.json. No public signatures.
3. Root reviews arithmetic, source divergence and representative rendered results through
   the established render_java helper and shared machine lease. Four render attempts max.
4. Root decides whether center/folding behavior is a clear useful tool, needs a different
   evidenced boundary, or should remain private. Only then admit a contract and delegate
   Java implementation. No acceptance based on successful helper execution alone.

The private proposal returns zero contribution at an exact center, explicitly departing
from the arbitrary positive-x source displacement. This does not remove the surrounding
singularity. If it cannot be taught honestly and used predictably, choose a different
boundary rather than hiding it behind a generic attractor name. Analytic cases cover
center/rim/empty identity, cardinal displacement and overlapping summed versus sequential
behavior. Curve transfer is a design test, not a second corpus recreation.

Projected recreation benefit: curvespace's defining radial field would become available;
its grid sampling and additive drawing can be ordinary host composition. A full source
walkthrough and native structural recreation would still be required to count it. No gain
is claimed for curves_str, culin or nabta from this proposed operation.

## Admission after the four reviewed renders

Root keeps curvespace#0 as geometry.radial-pull-2d, with explicit binary64, ordered-sum and
zero-center semantics. This is the candidate's radial computation, not its random center
construction, grid/drawing consumer or source RNG replay. Curvespace#1 remains an unresolved
consumer decision; it is not silently merged into the operation. Neighboring sequential
push and stochastic movement remain separate. See the CP19 experiment decision and
 design/operations/radial-pull-contract.md. No public implementation acceptance follows.

Artist inputs are explicit centers, radii and powers. They can be authored, edited or
seed-generated outside the transform. Each query returns a reusable point. The field is
immutable; radius/power edits create a new descriptor while drawing can reuse transformed
geometry. One concept of ordered influence summation replaces the defining algorithm;
ordinary polyline sampling and host drawing stay visible. No callback or renderer state
must be reconstructed to use it. Setup/storage and each query scale linearly with center
count, motivating a caller-reused output array and finite explicit workloads.

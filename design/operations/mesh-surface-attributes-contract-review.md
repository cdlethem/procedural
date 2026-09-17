# Mesh-attribute contract review

Root reviewed the H design, source-backed corpus identities, pinned p5 host probe,
complete schemas and analytical fixtures before implementation. One portable operation
owns face normals, group smoothing and exact UV seam expansion. No public host wrapper
or automatic UV chart is admitted. Root chooses equal unit-face weighting, conservative
3F vertex reservation, OUTPUT_LIMIT before WORK_LIMIT after complete static checks,
and exact dyadic degeneracy before rounded face arithmetic. Input order and represented
sums are intentional, including cancellation from rounded face-order accumulation.

A face index must first be a finite number (other values INVALID_INPUT); finite
noninteger/out-of-range and repeated corners give INVALID_TOPOLOGY. This explicit
clarification removes a carrier-versus-topology ambiguity from the proposal. Axis/structural
fixtures remain exact; two non-axis-normal oracles are separate with abs1e-12 per normal
component. No tolerance applies to positions, UV seams, indices or error cases.

The capability evidence is Davis Swarm Vertex Textures and Deskriptiv Living Mushtari;
root verified their corpus identities and stated mechanisms. Attribute preparation closes
lighting/seam handling, not either source's growth or fabrication process. Native checks
must test actual winding/depth, texture orientation, normal modes, independent shape/image
edits, transfer, cleanup and explicit context-loss scope before target acceptance.

The index carrier schema accepts numbers so the specified finite noninteger and
out-of-range cases reach the operation topology check. This corrects the schema
to the frozen failure semantics; no algorithm or expected output changes.

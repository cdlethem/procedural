# Annular contract review — accepted for implementation

Root reviewed the draft's six fields, ring and face traversal, immutable output and
indexed-access forms. Removed a non-candidate study entry from candidate provenance;
the study remains linked by the admission. Added explicit positive-radius schema bounds
and a concrete review path. Root accepts these semantics for Java-first implementation.

Counts: slices<=floor(2147483647/24)=89478485 ensures each 3*F index/normal buffer fits
signed-int addressing. F=8*S<=715827880 and V=4*S<=357913940. maxFaces may be715827881,
but does not permit a larger S. Use exact wide arithmetic and check the face budget
before mesh allocation. This ceiling is representational, not a safe working size.

Topology matches the reviewed corrected study: four rings; cell-major outer-wall,
inner-wall, top-annulus, bottom-annulus; two triangles per quad with welded seam.
Flat normals reuse the existing profile scaled-edge/cross policy. Inputs are finite,
but arithmetic collapse/overflow can still reject with faceIndex and stage, no result.
Root prepared two first-face error witnesses and component-specific allowances for six
success cases. Existing profile numerical infrastructure is reused without changes.

Root verified all26 fixtures through annular-specific dispatch and three rejection
mutations (reversed triangle, negative allowance, stale catalog hash). Both schemas
and all six successful decoded outputs validate. Numeric/access obligations are in
annular-fixture-plan.md; bounded Java execution is in annular-implementation-brief.md.
Production code may now implement this contract. Java conformance, access/ownership,
performance, native artist workflow and extracted-package review remain required;
this decision does not claim a shipped operation or public target support.

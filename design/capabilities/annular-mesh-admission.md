# Annular mesh capability admission

Root admits an independently specified closed annular mesh for contract preparation.
Artist task: create a ring with a visible hole, change its width/depth/faceting, and reuse
its faces for alternate colors or an arrangement. The six-view private study in
`evidence/parameter-experiments/annular-mesh/decision.md` demonstrates these edits and
transfer. This is architectural admission, not contract or implementation acceptance.

## Boundary and alternatives

Generate local indexed triangles from outer radius, inner radius, bottom Z, top Z,
angular slices and a required face budget. Return owned positions, triangle indices,
flat normals, face kinds and angular-cell identities. Geometry has four shared vertex
rings and eight triangles per slice, with a welded angular seam and no interior faces.
The solid occupies the annular band between the two radii and the supplied axial planes.
No random state, time, Processing types, material or renderer enters generation.

RadialProfile3D cannot represent inner/outer radii at the same Z or annular closures.
Combining separate profile surfaces leaves closure topology and normals to the artist.
A general closed-meridian operation adds contour validation and orientation rules without
an additional demonstrated use in this study. Keep it out of this admission; do not
silently broaden the existing profile operation or add redundant washer presets.

## Evidence and divergence

Motivation is `2017/Generativos/aros#0`, bound in the ledger. Root inspected its note and
upstream source and compared the existing profile admission. Source color sampling,
wall-clock rotation, placement and lights remain composition. Source repeated radial
interior faces, inner-wall winding and half-height mismatch are deliberately corrected;
they are not equivalent to the new closed solid. Full aros reproduction is not claimed.
The original candidate stays separately recorded; this dependency does not merge its
whole computation. No source code is copied.

The source has no measured variants. Study dimensions and slices are authored test
settings, not defaults or encouraged ranges. Mathematical requirements are positive
inner radius, larger finite outer radius, increasing finite axial endpoints and at
least three angular slices. Count ceilings are storage limits, not performance promises.

## Contract preparation requirements

Reuse radial-profile output terminology and indexed-access conventions. Freeze vertex
ring order and face traversal, including the two triangles per face-kind/cell. Specify
binary64 angle evaluation, transcendental comparison policy, signed-zero normalization,
scaled edge/cross-product normals, arithmetic failure detail and validation precedence.
Require exact count preflight before geometry allocation, no partial output, detached
exports and allocation-free indexed reads. Reuse established profile numeric conventions
where applicable rather than inventing a second normal policy.

Only after the catalog and distinguishing fixtures are complete may production code
begin. Fixtures must distinguish inner-wall reversal, duplicate radial interior faces,
seam duplication, budget rejection, malformed input and atomic indexed reads. A native
workflow must demonstrate width/depth edits and retained color/arrangement transfer.
Ports remain deferred; the private P3D study does not attest public target support.

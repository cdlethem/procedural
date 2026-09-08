# Annular mesh private study decision

Root inspected all six native P3D images recorded in experiment.json and verified source
and runtime input hashes after execution. Select the minimal annular-mesh boundary for
contract preparation: separate inner/outer radii, axial endpoints and angular slices,
with retained indexed triangles, flat normals and face-kind identity. This is study
acceptance only, not a public contract, implementation acceptance or new shipped operation.

The fixed-camera width/depth/facet comparisons are visibly distinct; recolor preserves the
silhouette and the arrangement reuses the same mesh. The complete configurations, image
hashes and objective differences are in experiment.json. These discrete values establish
useful edits, not defaults or continuous encouraged ranges. No source reproduction or
wall-clock animation claim is made. Broader closed-meridian modeling adds profile validity
and orientation questions without an additional demonstrated use in this comparison.

Root reviewed the corrected inner/bottom perimeter order and the pure checks: four rings,
eight triangles per slice, each edge shared twice in opposite directions, outward normals
and Euler characteristic zero. The private implementation is restricted to modest slice
counts and is not numerically hardened across a future public input domain. Public work
must specify numeric failure behavior, ownership, allocation-free access and budgets.

The native process emitted the existing P3D Xvfb DRI3/unclosed-display shutdown diagnostics;
its exact stderr is preserved in native.json. All six saves completed with exit0. This is
software-rendered local appearance evidence, not GPU performance or shader certification.
No new render is justified before contract/implementation changes require one.

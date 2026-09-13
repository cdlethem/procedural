# Geometry and layout contract review

Root approves the ten corresponding catalog entries for p5 implementation after
reviewing the artist-task boundaries, independent architecture challenge, complete
geometry draft, proposed schemas and analytical fixture outputs. The catalog is
normative; the draft records design preparation and is not a support attestation.

The decisions preserve caller-owned paths, source identities and substitutable
rendering. Simplification is explicitly open and uses finite-segment distance;
refinement instead cuts corners. Offsets return joined parallel paths without
self-intersection repair. Hulls omit collinear interior sites; triangulation
accepts strictly simple nondegenerate polygon boundaries and deterministic ears.
Chain assembly uses exact coordinates and rejects branching topology. Poisson
sampling exposes reproducible LCG state and bounded active-frontier events.
Lloyd relaxation composes the accepted Voronoi operation, including its duplicate
ownership. Rectangle packing is a skyline heuristic; cost paths return all
distances/predecessors with strict-improvement ties and no diagonal routing.

Root corrected the cost-grid analytical budgets to N*N+5*N (36 for four cells)
and increased the skyline bound to 8*N*N*N+N to cover naive candidate/span scans.
Touching skyline spans count as overlap only for positive horizontal width.
Root checked the concave polygon's ear order and area, direction-independent cycle
edge IDs, Poisson recurrence and out-of-domain rejection consumption, Lloyd's
separate child/centroid allowances, and queued equal-distance predecessor ties.
General floating-point properties and randomized spatial-index agreement remain
implementation checks; analytical fixtures alone do not establish those properties.

All static schema/value checks precede work preflight; topology and generated
numeric checks follow it. Required budgets distinguish representational limits
from allocation or latency promises. Schemas and parameters contain no invented
recommended ranges. Geometric classification uses binary64 without epsilon or
robust-predicate guarantees. Empty/duplicate cases and signed-zero ownership are
explicit. Every successful output is detached; failures return no partial state.

Native acceptance remains pending two meaningful original studies per operation,
structural edits, style transfer, reset/replay/save and root image inspection.
Other target implementations and new surveyed-original recreation claims remain
outside this batch. Subsequent milestones must preserve previous Studio bindings
and append-only public export compatibility before publishing and deploying.

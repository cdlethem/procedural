# Nearest-contact contract review

Root accepts the contract and26shared fixtures for Java implementation. This is not core,
native, distribution or original-sketch acceptance. The Phase2 dependency gate passes.

Root reviewed the complete contract, fixture generator and independent rational contact
oracle. Checked endpoint/origin/collinear and degenerate behavior, query-order misses,
exact-tie ordering and exact selection before rounding. Added mixed hit/miss order,
signed zero, collinear endpoint touch and identical point cases. Verified the adversary
where two contact parameters round to0.5but obstacle1is exactly nearer. Both parameter
underflow and midpoint point-rounding collapse have explicit independently checked witnesses.

Corrected generator comparison metadata and bound its indirect cross-product dependency.
Static invalid queries/obstacles precede work-limit failure. Work is pair-count allowance,
not a performance recommendation. Catalog schemas/source bindings/generated reference pass.
Root retains Java semantic/ownership review and actual native acceptance responsibilities.

Implementation boundary: share only accepted exact rational arithmetic through a package-
private geometry helper. Do not change clipper predicates, ordering, errors or rounding.
Preserve all34clipper fixtures and full focused native output before accepting that refactor.
Nearest-contact must compare26shared cases as raw numeric bits and exact error details;
include Java-only carrier/ownership/index tests and bounded representative work measurements.
No public numeric defaults or useful artistic ranges are invented by this contract.

## Frozen artifacts

- catalog/operations/nearest-segment-contact-2d.json — 3c5d06d3042d992205f0719cac2061a25653bf26edf5c3d70b0ec56f65489e54
- fixtures/operations/nearest-segment-contact-2d.json — f0f572015e30260bdcc4fa122f302bb3e8a6c857eaf71dc11915dbe206458f46
- tools/diagnostics/clipping/build_nearest_contact_fixtures.py — 261b9e33308f01caace3d34825bd6904de26f0d1ea6c293464d9d885eca93c20

# CP11 contract acceptance

Root accepts `path.occupied-lattice-paths-2d` version 0.1.0 for Java implementation.
This is contract acceptance, not implementation, reproduction or package acceptance.
Sol review remains paused by maintainer instruction. Root retains final quality ownership.

Root read the complete contract, shared vectors and independent Python transition/RNG
oracle. Earlier source review and component admission are recorded in
`design/capabilities/cp11-admission-review.md` and `cp11-lattice-decision.md`.
The computation removes shared occupancy and ordered path generation from sketch glue;
callers retain starts, layout scale, style and composition decisions. Tata motivates the
capability, with explicit changes to start reservation, neighbour selection, stopping and
random-stream policy. No source equivalence or recommended visual ranges are inferred.

Corrections required by root are incorporated: field-ordered access validation, conservative
wide potential-output admission, two-coordinate storage bound, unsigned returned state,
materialization cost including empty paths, a true three-neighbour fixture distinct from
four-neighbour selection, and a tracked reproducible oracle. The ten success vectors were
independently rerun by root with exact equality; all source and catalog bindings matched.
Four error vectors cover cross-field start validity, invalid state before capacity,
conservative budget rejection and mutually exclusive random carriers. The oracle only
computes valid inputs; these error expectations require actual native execution.

The fixtures distinguish reserved starts, no-word blockage, one-option word consumption,
shared ordered occupancy, continuation state, empty input and sparse maximum dimensions.
The catalog checker checks JSON shape and exact-comparison metadata, not algorithm truth.
The focused checker suite passed 29 tests during integration. Native carrier/ownership,
access precedence, atomic destination writes, wide arithmetic and allocation/scaling checks
remain explicit obligations in `cp11-java-implementation-brief.md`. Artist acceptance remains
in `design/capabilities/cp11-lattice-marks-acceptance.md` and has not run.

Frozen artifact hashes:

- Catalog: dbcb29575544aa194dd8baf4615bb404633046d3f8a92c76b45d13af73b4d01d
- Fixtures: 220d57e7d42413063a777066fe6d3addff4ad9c1d987bc34ba0ac36d0ad25d98
- Oracle: dd0841f12f1f357725794cb507d171b175833318c4127d81aa1d7fb0c6420fa1

# CP5 triangle contract review

Status: root accepted and frozen for Java implementation. Sol review is paused under the
maintainer sprint instruction. Both capability-dependency admissions pass the Phase 2
prerequisite checker. No runtime, installed package or reproduction support is claimed yet.

Root reviewed the source evidence, seven private images, the complete catalog records,
the independent fixture generator and triangle-points-output checker. The two responsibilities
remain seeded uniform-area point batches and explicit unit-coordinate mapping batches.
They share retained geometry; neither owns triangle construction, style or drawing.

## Decisions and corrections

The contracts specify complete xoshiro seed expansion/consumption, correctly rounded sqrt,
nested endpoint-aware interpolation, opposite-sign selection, final interval clamp, +0,
finite collapsed triangles, passive input carriers, detached outputs and access precedence.
No parameter defaults or encouraged ranges are inferred from fixture values. Count bounds
are representational, not measured performance or artistic limits. Other ports are deferred.

Root corrected the oracle to validate count-zero input fully and return before RNG
construction. Root also required checking emitted uint32 pairs against their unit values,
forbidding generated-stream fields on errors/explicit mapping, and rejecting boolean draw
metadata. Java pointAt's detached double[] carrier is explicit in both contracts.

## Verified evidence

- Independent fixture generation reproduces both files byte for byte: 27 seeded and 32
  explicit cases, including endpoints, one-ulp arithmetic ordering, constant coordinates,
  extreme/subnormal values, tiny/collinear/repeated triangles, invalid input and zero count.
- All five initial/consecutive xoshiro vectors agree with the existing independent CP3
  oracle and CP3 fixture. Prefix4/8 and three actual seeded-to-explicit mappings agree in
  generated coordinates, output values and exact point bits.
- Root independently checked all 24 distinct fixture u values: for r=host sqrt(u), exact
  rational squares of the midpoints between r and its two adjacent binary64 numbers bracket
  u (ties permit only an even significand). This proves correctly rounded square roots for
  these concrete fixture inputs; it is not a universal host sqrt proof.
- The complete catalog checker and generated reference pass. All 111 repository unit tests
  pass. Both Phase 2 dependency prerequisite checks pass. Checker validation does not execute
  the mapping/RNG kernel and does not establish native conformance.

## Frozen implementation inputs

- `catalog/operations/seeded-triangle-points.json`: `610e25f26407f4c0cea1ca5335c28d46c2ff49453bec949dbc84bd3a34903bb8`
- `catalog/operations/triangle-coordinate-map.json`: `81992a9369392ef272262104c36111d31ed3ea838bea8c7d53c9d3854ffcf78f`
- `fixtures/operations/seeded-triangle-points.json`: `719a6d292dbf6a81683f7635dc49100a28fc3452c128b5ce8fdf6c473c5af35e`
- `fixtures/operations/triangle-coordinate-map.json`: `b6f303d718093c6f587f793ed40e19346d8844dbeffeb4c15e86f9d343644607`
- `tools/generate_triangle_points_fixtures.py`: `358cafdc640770e3c27e6816e3536d1e297d4285836bcad8d009b78aef9e5d23`
- `tools/check_catalog.py`: `61f73674845ce06efa0967dc87949262b1474e6fbe07780deea7947c696d7796`
- `tests/test_catalog.py`: `1331d4b3cd17af51c7296fea5ccd3dcd02e5c15012aa01680e0b13af39d92c03`

## Required native follow-through

Implement only the two approved Java factories and common retained result. Run every fixture
against the actual class, then validate ownership, type rejection, index precedence and
atomic destination writes. Inspect allocation/validation ordering and the no-FMA arithmetic;
measure small, motivating and stress workloads with checksums. Allocation failure tests must
state what actually ran and what is source-inspected only. Frozen CP3/CP4 Java sources remain
unchanged. Public GrainMarks must exercise seed/count/distribution edits, retained geometry
across style/mark changes and CP4 cell transfer. Private images are architectural evidence,
not proof that this new stream/arithmetic or the installed package works.

# CP5 shared triangle point fixtures

Root plan; consume the two catalog drafts unchanged. No production implementation exists.
Use `triangle-points-output`, with operation/version, fixture status, catalog SHA, cases,
exact output point bits and declared cross-case checks. Fixtures are semantic oracles,
not measured parameter ranges. Generator may read catalog and shared CP3 seed vectors;
it must not import any future production TrianglePoints2D implementation.

## Explicit mapping cases

- Empty coordinates with valid ordinary, repeated and tiny triangles; invalid triangle
  still fails with empty coordinates.
- u=0 with several v values returns A; u=1,v=0 returns B; u=1,v=1 returns C. Include
  extreme opposite-sign coordinates and negative zeros to catch eager overflowing lerp.
- Ordinary ordered pairs; repeated pairs retain duplicate positions; reversed vertex
  order changes coordinate interpretation. Include (u=.25,v=.5) on A=(0,0),B=(2,0),C=(0,2).
- Ordinary rounding adversary: x endpoints (1,3,-2),u=1/16,v=.7; expected nested x bits
  3fe4000000000000, unlike direct-sum ...0001. Choose a nonconstant valid y axis too.
- Constant triangle coordinate1 with u=2^-53,v=.2 retains exact1; constant -MAX with
  u=2^-53,v=.25 retains exact -MAX. All repeated vertices are accepted.
- Finite +/-MAX endpoints, minimal subnormal coordinates and near-one units; no area
  calculation, intermediate opposite-sign subtraction or noncanonical output zero.
- Tiny noncollinear legs2^-600 map without determinant rejection; tiny exact collinear
  and repeated-vertex triples also map. No area-uniform arclength claim is encoded.
- Explicit source-motivated nonuniform pairs such as (U*V,W), alongside unchanged ordinary
  pairs; mapping must preserve caller-provided order and must not silently draw RNG.
- Malformed record, missing/extra keys, wrong triangle length/pair shape, boolean coordinate,
  malformed unit outer/row, later invalid row, u/v below0 or above1. Native-only nonfinite
  and exotic-carrier checks remain separately required if not representable in strict JSON.

## Seeded cases and equivalence

Use five shared seeds 0,1,42,2147483648,4294967295. Verify the complete initial state and
first ten output/state vectors against the independent existing CP3 oracle. Exactly two
uint32/2^32 units per sample, u then v. Record generated units and expected mapped bits.

Include count0, count1 and count-extension pair4/8, ordinary/reordered triangles, constant
vertices, collapsed collinear and noncollinear underflow-scale triangles, finite extrema,
negative-zero seed/count/vertices, and wrong/missing/extra keys or invalid seed/count bounds.
For a nonempty zero-area triangle, the same two units per point remain required.

For several seeds, place an explicit mapping case using the very same generated unit pairs
and bind exact cross-operation equivalence. The checker must resolve those case identities
and verify every point bit, not merely assert that both fixtures exist. Prefix assertions
must compare actual output and input equality except count; do not infer from IDs alone.

## Native and runtime obligations

Record these as requirements, not claims that JSON fixture generation executed them:
input/pointAt/toValues detachment; scalar type and invalid-index precedence; atomic
pointInto destination writes including sentinels, offset edge/overflow and wrong carriers;
no output-sized allocation/RNG before complete static validation; no retained input/stream;
resource failure source inspection and scoped execution; no per-point object allocation
in the seeded inner loop; representative-range work/memory measurements; correctly rounded
sqrt and no FMA/reassociation; installed PDE independent style edits and CP4 transfer.

The final endpoint clamp is a specified guard. The 200,000-case numeric supplement found
no excursion, so do not invent a concrete clamp-triggering fixture or claim the scan proved
it unnecessary. Verify exact endpoints and range invariants, and inspect the implementation
for the complete specified interpolation kernel at native review.

## Checker scope

Validate schemas, error/success exclusivity, lengths, finite canonical pairs, exact stored
bits, per-coordinate bounds, required distinguishing categories, five seed vector identity,
actual prefix/equivalence references and operation/catalog binding. Reject unknown fixture
formats. Do not reimplement sampling inside the catalog checker or report metadata checking
as native runtime conformance. Root reviews generated expected values before contract freeze.

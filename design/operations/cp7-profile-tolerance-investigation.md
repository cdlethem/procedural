# CP7 profile-surface tolerance investigation

This is a private engineering interval investigation for the draft
`mesh.radial-profile-surface-3d` contract. It does not amend the draft catalog, create a
fixture, approve a target, or state a universal sine/cosine accuracy claim. Root must
select any final per-case acceptance policy after native target verification.

The diagnostic is [profile_intervals.py](../../tools/diagnostics/cp7/profile_intervals.py).
It uses the draft construction order: local positions from `theta=(TAU*cell)/slices`,
separate radius/trigonometric multiplication, componentwise edge subtraction, independent
max-component edge scaling, ordered cross, max-component cross scaling, ordered square
sum/square root, and componentwise final normalization. It does not call a public mesh
implementation.

For each nonzero theta, the local Python `sin` and `cos` reference was widened by two
adjacent binary64 values below and above, then clipped to `[-1,1]`. At theta zero the
reference is exact: `sin=+0`, `cos=1`. Every subsequent nondegenerate interval operation
is rounded outward by one adjacent binary64 value at each bound. Exact point operations
and a product with an exact zero stay exact. This is an explicit, testable engineering
assumption for later native verification. It does not establish that every target's
transcendentals fall in that envelope.

A calculation is **inconclusive**, not tolerated, when a bound is nonfinite, a divisor
interval contains zero, or a square-root interval can be negative. The diagnostic does
not introduce a global epsilon to make such a case pass. Exact topology, face metadata,
indices, counts, and same-runtime binary64 results remain outside this tolerance exercise
and must compare exactly.

## Self-contained observations

The command below ran without a renderer:

```sh
python3 tools/diagnostics/cp7/profile_intervals.py
```

It tested small cylinder/waist/frustum/end-pole meshes plus uniform `1e200` and `1e-200`
scale cylinders. All six had finite interval bounds under this local engineering model;
that only says these cases are suitable candidates for bounded native checks.

| case | faces | max position allowance x/y/z | max normal allowance x/y/z |
| --- | ---: | --- | --- |
| cylinder-s3 | 12 | `3.3306690738754696e-16`, `3.3306690738754696e-16`, exact `0` | `7.105427357601002e-15`, `5.773159728050814e-15`, `1.3211653993039363e-14` |
| waist-s4 | 24 | `3.3306690738754696e-16`, `3.3306690738754696e-16`, exact `0` | `8.548717289613705e-15`, `8.43769498715119e-15`, `1.0658141036401503e-14` |
| frustum-s4 | 12 | `4.440892098500626e-16`, `4.440892098500626e-16`, exact `0` | `4.773959005888173e-15`, `4.884981308350689e-15`, `1.0658141036401503e-14` |
| end-pole-s3 | 6 | `3.3306690738754696e-16`, `3.3306690738754696e-16`, exact `0` | `7.216449660063518e-15`, `5.773159728050814e-15`, `1.3211653993039363e-14` |
| uniform-1e200-s4 | 16 | `3.3992831540273094e184`, `3.3992831540273094e184`, exact `0` | `4.6629367034256575e-15`, `4.6629367034256575e-15`, `1.0658141036401503e-14` |
| uniform-1e-200-s4 | 16 | `4.351253279789337e-216`, `4.351253279789337e-216`, exact `0` | `4.6629367034256575e-15`, `4.773959005888173e-15`, `1.0658141036401503e-14` |

The coordinate allowances scale with the radius. The two extreme uniform cases remain
finite under this model, while their raw absolute coordinate allowances differ by 400
orders of magnitude. A fixed absolute position tolerance would therefore be a poor
cross-scale policy. The normal envelopes are roughly `1e-14` in these cases, materially
wider than the private same-host direct-versus-scaled comparison maximum
`6.245004513516506e-16` in
[evidence/investigations/cp7-normal-numeric-review.json](../../evidence/investigations/cp7-normal-numeric-review.json).
The latter compares two arithmetic algorithms on one host; it is not a substitute for the
interval enclosure.

All z coordinates were exact because they are copied profile values. The position record
also reports exact component counts: fixed axial coordinates, pole/centre x/y zeros, and
theta-zero coordinates can remain exact when the stated algebra forces them. Normal
components were not exact in these enclosures because triangle positions depend on the
widened trigonometric values; this is a property of the conservative dependency model,
not a request to weaken exact topology comparisons.

## Consequences for fixture planning

No number in the table is approved as a blanket tolerance. A later fixture policy should
bind each selected profile/cell case to its own position and normal envelopes, distinguish
exact algebraic coordinates from trigonometric ones, and verify the stated envelope against
actual JavaScript/Python/Java target results. It must reject an unbounded or
zero-divisor-possible interval rather than silently expanding it.

The diagnostic detects `.work/cp7-contract/fixture-cases.json` when that draft appears,
but does not consume it yet. Fixture construction must add cap/pole/seam/winding and
near-collapse cases, then rerun the interval diagnostic with their explicitly registered
profiles. It must keep dynamic failures separate from tolerance cases and must not use an
envelope to excuse a changed index, face kind, band, cell, count, or error stage.

The source uses no renderer, P3D context, source sketch code, or target port. This is
local Python float interval arithmetic for policy exploration only.

## Root follow-up: fixture-specific policy

The table above preserves the initial six-case observation, before the root tightened
singleton rounded endpoint propagation, exact zero division, and strictly axis-aligned
normal handling. It must not be read as the current per-component allowance table.
The selected policy is now in [cp7-profile-fixture-policy.md](cp7-profile-fixture-policy.md).
All 17 current draft successful fixtures have bounded per-component allowances, including
minimum-subnormal direct division. The staging allowance file is
`.work/cp7-contract/fixture-allowances.json`.

Root read and strengthened `check_profile_enclosures.py`: it tests both opposite
cosine/sine endpoint combinations in addition to both-low, both-high and alternating
patterns, and exits unsuccessfully on any failure or an empty case set. All 85 runs
across those 17 fixtures passed. This finite perturbation diagnostic checks interval
propagation and exact reference topology correspondence, not actual target trigonometry.
The source-bound report is `.work/cp7-contract/enclosure-perturbations.json`.
Shared fixture validation, mutation rejection and native acceptance remain outstanding.

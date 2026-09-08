# CP7 profile fixture policy

Root's selected policy for the forthcoming radial-profile contract and shared fixtures.
This records an engineering decision, not target acceptance. The catalog remains the
normative operation definition; this note explains how its numerical obligations will
be checked. No public implementation is approved by this note alone.

## Exact and bounded comparisons

Require exact counts, ordered triangle indices, face kinds, bands, cells, error codes
and error details. Also require canonical positive zero for every exported zero. No
coordinate tolerance can excuse missing faces, changed winding or altered metadata.
Copied axial coordinates, pole and cap-centre coordinates, and other components with
zero derived allowance compare exactly to the reference binary64 value.

For the same target and runtime, repeated generation from equivalent inputs must match
every retained output bit. This does not require Java's trigonometric results to match
Python's reference bits. Cross-runtime checks use a separate nonnegative absolute
allowance for each position and normal component of each registered successful case.
There is no global epsilon, relative-error fallback or silent allowance expansion.

Derive these allowances with `tools/diagnostics/cp7/profile_intervals.py`. At nonzero
theta, enclose the reference sine and cosine by two adjacent binary64 values in each
direction, clipped to [-1,1]. At theta zero use exact sine zero and cosine one. Propagate
those intervals through the specified position and scaled-normal arithmetic. Preserve
exact rounded endpoint results when the lower and upper computed endpoints coincide;
monotonic rounded operations then have no intermediate output outside that singleton.
Zero numerators remain exact after excluding a zero divisor. A cross with two exactly
zero components and one strictly signed component normalizes to an exact axis vector.
Otherwise widen non-singleton rounded bounds outward as the diagnostic specifies.

The allowance is the maximum absolute reference-to-bound distance. A nonfinite bound,
possible zero divisor or other inconclusive interval blocks that case's bounded-check
approval. It must be investigated, not assigned a larger guessed tolerance. Bind the
generated allowances to their inputs and diagnostic source hashes. Require exact array
dimensions before component comparisons so a shortened result cannot pass a zip loop.

This two-adjacent-value trigonometric envelope is a selected fixture engineering model,
not a proof about every host library or arbitrary input. Native validation must check
the selected cases on each claimed target. Near geometric collapse, host trigonometry
can change a rounded degeneracy; do not claim universal cross-runtime success/error
equivalence for arbitrary finite profiles. Registered error witnesses must nevertheless
match their declared first failing face and stage on every claimed target.

## Required complementary checks

The draft currently supplies 24 successful meshes and 19 error cases. Before fixture
freeze, verify their exact expected counts and metadata independently, all closure/pole
combinations, seam wrap and winding. Prove that deliberate in-range index, ordering,
metadata and normal mutations fail. Check the three demonstrated dynamic stages, static
validation before capacity, and capacity before geometry arithmetic. The minimum-subnormal
success distinguishes direct component division from reciprocal multiplication.

The separate count proof covers the signed-array ceiling without attempting enormous
allocations. Ordinary native workloads must still measure bounded work and retained
storage. Native access tests must cover detached copies, input mutation, rejected indices
and atomic buffer writes; serialized mesh vectors cannot establish those properties.

Perturbing reference trigonometry within the envelope is a useful diagnostic of interval
propagation. It is neither an exhaustive proof nor native target evidence. Similarly,
the accepted seven-image private prototype establishes the selected artistic workflow,
not the correctness of the future public implementation or its installation.

# CP10 target-spring contract and fixture review

Root approves `motion.target-springs-2d`0.1.0 for Java implementation. This is a
contract/fixture approval, not implemented/native/visual support. Sol reviews
remain paused under the maintainer's Java-first sprint instructions.

The authoritative entry is
[`catalog/operations/target-springs-2d.json`](../../catalog/operations/target-springs-2d.json).
Its sole shared fixture file is
[`fixtures/operations/target-springs-2d.json`](../../fixtures/operations/target-springs-2d.json).
The [admission](../capabilities/cp10-admission-review.md),
[contract decisions](cp10-contract-decisions.md), and
[parameter decision](../../evidence/parameter-experiments/cp10-spring-response/decision.md)
explain provenance, boundaries and the absence of recommended defaults/ranges.

Root selected a complete portable before/after state, with explicit per-body
position, velocity, strength and retention, plus same-length per-step targets.
Per-body retention preserves independent source responses; per-body strength is
a declared generalization of the same independent recurrence. Native storage
is a fixed-size owned mutable batch, with immutable coefficients and detached
observations. Canonical-list and packed-target stepping consume the same logical
input, including a packed double array passed through Object. Snapshot/edit/import
supports coefficient changes and replay without a hidden reconfiguration API.

Each body is computed x completely then y, before the next body. Static validation
of all state and targets precedes arithmetic. Every subtraction, multiplication
and addition rounds separately, with an immediate finite check. Scratch values
commit only after the whole batch succeeds. Negative zero is canonicalized at
input/output boundaries, and no zero-coefficient fast path may skip an observable
arithmetic failure. Retention0 permits the current position step; retention1
makes no settling promise. No clock, pointer, RNG, topology or rendering belongs
in the operation.

Root independently tested14 arithmetic witnesses and a12-step target sequence in
`.work/investigations/cp10-numeric-policy1/result.json`. The exact-rational and
ordinary floating evaluations agreed on completed binary64 outputs and first
failure stages. The no-FMA witness produces2 with separate operations versus
2.220446049250313 when the multiply/add is fused. All four reachable overflow
stages have finite-input witnesses; retention-product overflow is unreachable
for finite advanced velocity and retention in[0,1].

The initial numeric memo incorrectly used input velocity-0 to establish a raw
negative-zero advanced velocity. Input canonicalization invalidates that argument.
Root corrected the witness before fixture acceptance: a negative advanced velocity
times zero retention produces the final negative zero that must be normalized.
The numeric memo remains historical investigation, not the contract authority.

The accepted shared file has44cases:27successes and17errors. Coverage includes
empty state, equilibrium, source-shaped first/second updates, strength0 transport,
retention0 advancement, retained subnormals and nearest-even underflow, no-FMA,
heterogeneous and coincident independent bodies, maximum-finite equilibrium,
canonical input/output zeros,12chained changing-target steps from nonzero state,
and explicit mid-sequence restoration. Error cases distinguish four overflow
stages, body/axis precedence, a late y-axis failure, complete-static-before-dynamic
precedence, keys/types/coefficient domains and body-target length mismatch.

The generator uses ordinary separately evaluated Python binary64 operations.
The independent validator in `tools/check_spring_fixtures.py` imports no generator
or future implementation: it computes each stage with exact Fraction arithmetic,
rounds that stage to binary64, and checks exact output/error, body order, canonical
zeros and sequence/restore links. Ten mutation tests verify that wrong positions,
coefficients, negative-zero outputs, error precedence, broken sequences/restores,
fused results and damp-before-position behavior are rejected. Native code must
consume the unchanged shared fixture; regenerating expectations from Java is not
an acceptable test.

Implementation must still prove deep state/export ownership, every native carrier,
continuing batch behavior on both step paths, late-failure atomicity, safe-index
and Into-buffer boundaries, and allocation-free warmed packed stepping. Shared
pure vectors alone do not prove those properties. The representational body ceiling
is not a realistic allocation promise; native representative/stress measurements
are required. An ordinary artist example must then demonstrate disturbance,
retargeting, pause/step/replay, style-only edits and fixed-index deformation, with
all changing frames and a cached save checked in the actual renderer.

All targets remain explicitly unimplemented/unvalidated. The accepted source
Processing-float parameter images are evidence for control selection only; they
do not attest to this proposed binary64 core or to SpringMarks. No new package
release is claimed by this review.

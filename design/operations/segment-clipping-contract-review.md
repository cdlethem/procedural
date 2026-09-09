# Segment clipping contract review

Status: accepted for Java implementation. Root reviewed the sole active catalog entry
`catalog/operations/clip-segments-simple-polygon-2d.json` and34 shared fixtures. The former
draft entry was moved, not duplicated. No production implementation, native workflow,
port, original recreation or distribution acceptance is implied.

Root verified source/note divergence, simple concave polygon validity, exact interval and
coordinate rounding, canonical zero, all three representation-collapse stages, work and
output accounting, full static validation precedence and retained source/interval order.
Indexed-access obligations are frozen in the contract and require Java-specific checks.

The focused validator checks schemas, source bindings, bit patterns, output topology/order,
independent Fraction outputs and independently evaluated ordered errors. Root corrected its
strict crossing predicate before integration. Reversed intervals, stale catalog hash and
altered coordinates are rejected in mutation probes. Full catalog/schema/reference check
passes with the new format registered; no existing check was relaxed.

Private studies establish feasibility and artist purpose. Production must add complete
passive-carrier validation, packed ownership and access tests, explicit budgets, representative
allocation/performance evidence, exact-core native edit/transfer and extracted-package use.
Follow segment-clipping-java-brief.md. Ports remain deferred, and root retains final integration.

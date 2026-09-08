# CP3 implementation assignment

Status: root approved and froze both contracts/fixtures; Java implementation is authorized.

## Authority and ownership

Root owns both circle-placement catalog entries, shared fixture approval, Java workflow
integration and final architectural acceptance. The maintainer now prioritizes Java-only
capability expansion; Python, JavaScript and Android ports are deferred to a later batch. The Java worker owns a new
`org.procedurals.sampling.CirclePlacements2D` implementation and its native tests. No JavaScript or Python implementation is assigned in this slice. Root reviews implementation directly; Sol reviews are paused for this buildout sprint. Assignments begin only after root publishes exact contract and fixture
hashes; workers must return ambiguities instead of independently changing semantics.

Read both catalog entries and the contract review. Implement the language-neutral
specification independently, preserving motivating-note citations; do not copy upstream
PDE or treat the private Java experiment as production code. Apply portable-operation-
implementation and generative-performance skills. Android shares the Java algorithm;
Java host success does not establish execution on Android.

## Required behavior

Each target implements both entry points with one retained result and one ordered pair
kernel. Stream seeded proposals; retain only accepted packed geometry and source indices.
Validate all static explicit input before retained allocation or pair arithmetic. Avoid
allocation and container dispatch inside retained-pair loops. Grow primitive storage
without arithmetic overflow; do not eagerly reserve the maximum proposal count. Invocation
supplies the finite attempt budget; no saturation or universal latency guarantee is implied.

Consume all shared fixture cases, exact binary64 outputs, dynamic error indices/stages,
seed/state and mapping vectors, cross-case prefix checks and seeded/filter equivalence.
Native tests must cover input and output mutation, every accessor, numeric carrier rules,
index-before-output validation, negative zero and destination preservation on failure.
Direct mapping vectors must exercise the actual internal proposal mapper, including the
no-FMA and no-reassociation adversaries. Keep any test access private to the target build;
do not expose a new public RNG or mapping entry point merely to reach these vectors.
Use controlled host resource failure where feasible; distinguish an untested failure
mechanism from an executed test. Do not add public RNG access for test convenience.

Record tiny, motivating 5,000/10,000-attempt and bounded stress measurements with actual
runtime, warmup, repetitions, geometry checksum and precise memory scope. Pure conformance
reports explicitly exclude rendering and Android until their native checks exist.

## Integration and delivery

Use new isolated CP3 build/report paths. Preserve frozen CP3 investigation evidence and
accepted CP1/CP2 packages. Workers do not edit existing public export indexes, shared
catalogs, fixtures or earlier attestation records. Root integrates additive exports and
reconciles evidence bindings deliberately after review.

Core success is the next milestone, not completion of the Java CP3 workflow. Root then integrates an editable
placement starter with seeded replay, separation/minimum/maximum/budget edits, retained
geometry across palette/motif edits and caller-authored radial transfer. Declare native
command, rendering, lifecycle/save and performance acceptance before execution. Validate
the Java target scope, document controls without invented ranges/defaults, build the new
local Java package and complete root source/native/visual/distribution review. Then
expand Java artist capabilities. Keep the other three target checks and packages in the
batch-porting backlog; recipe/MCP/web milestones follow library delivery.

## Frozen authority

Root accepted the completed Sol contract/fixture review, changed only catalog status to
reviewed and regenerated fixture bindings plus the catalog reference. Catalog validation
passes. Subsequent sprint implementation review is owned directly by root.

- `catalog/operations/ordered-circle-filter.json`: `d4e93aa0dc219b0730af1e3eecad5cb9a8be3030e9f0761b9b23d0886f6c2083`
- `catalog/operations/seeded-circle-placement.json`: `04de90b19cbd39a5aa4840dfd1ee80cbeb96b69b9981af95b176be7bc0480267`
- `fixtures/operations/ordered-circle-filter.json`: `b5fb3743676b6a268b3cfa8467e727a2e713482feff2fa44ac08c71d976f103b`
- `fixtures/operations/seeded-circle-placement.json`: `c625d372435be9ae25e721407458ba4c189cfae48c09e4cd530ebfa6e8240699`

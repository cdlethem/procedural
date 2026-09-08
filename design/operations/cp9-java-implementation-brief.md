# CP9 Java implementation handoff

Status: prepared by root while shared fixtures are under review. This is an
implementation task brief, not authorization to bypass contract freeze. The final
canonical catalog entry and its reviewed shared fixtures own all public semantics.
Do not implement from the temporary catalog draft or infer unspecified behavior.

## Scope after freeze

Implement `org.procedurals.topology.Delaunay2D` in the Java core, with the exact
factory, accessors, error fields and passive carriers from the frozen catalog.
Read the portable implementation, deterministic semantics and generative performance
skills. Root owns catalog, fixture and generated reference integration. Preserve all
previous accepted operations, fixtures, runtime evidence and distribution artifacts.
No source triangulator code is to be copied into this independent implementation.

Use the corrected schedule oracle only as reference evidence. In particular,
do not copy the earlier prototype's all-containing-face scan, full incidence rebuild
or global edge reenqueue. The production schedule stops at the first containing
face in active creation order and updates a constant-sized topology neighbourhood.

## Recommended internal structure

These are implementation choices, subject to output-preserving refinement:

- Validate the complete passive input first without retaining an input-sized copy.
  Validate integral domains before narrowing. Then charge N atomically, copy,
  canonicalize zeros, sort/deduplicate and build both mappings.
  Iterate passive input Lists linearly; repeated get(i) on a LinkedList would
  silently violate the preprocessing bound. Sort the owned random-access copy.
- Decode finite binary64 coordinates into exact dyadic integers. The feasibility
  probe demonstrates standard `BigInteger` arithmetic without a dependency. Reuse
  immutable decoded coordinates; do not parse strings or allocate host geometry
  objects in predicate calls. Any fast path needs proof and adversarial fixtures.
- Maintain an active doubly linked face sequence with local removal/append, plus an
  edge-to-incident-faces map. Sort only each replacement batch before appending.
  Reclaim removed nodes. No mutation-history storage in the result or work loop.
- Represent an undirected edge by canonical endpoint indices. A packed nonnegative
  long key `(u << 32) | v` orders these admitted indices lexicographically; use
  explicit wide promotion before shifting. A sorted set can provide minimum
  extraction and duplicate suppression. Charge before removing its minimum.
- After legalization, materialize sorted final face triples, edges and face
  incidence into owned primitive arrays. Include original-input mapping storage in
  memory accounting. Retain no exact-predicate buffers in the finished result.
- Into access validates the full request before writing. Check remaining capacity
  without offset addition overflow. Scalar counts and index reads are O(1).

Exact integer arithmetic necessarily allocates intermediate integers; distinguish
that cost from avoidable per-face container rebuilding. Do not promise allocation-free
construction. Ordinary retained traversal through Into must avoid per-item carriers.

## Required handoff evidence

Consume the shared fixture JSON unchanged in a native Java harness. Bind the tested
catalog, fixture, implementation and harness sources. Report successful and error
case counts and exact coordinate/topology/work comparisons. A Python call producing
Java expectations at runtime is not Java conformance.

Add meaningful native checks for caller-input mutation, detached At/toValues output,
all input/vertex/face/edge index domains, Object/long overload equivalence, safe
integer limits, destination widths, failure atomicity and positive-zero output.
Exercise invalid final input rows with exhausted budgets. Host allocation failures
must not be translated into plausible empty meshes.

Benchmark tiny inputs, hundreds of sites and a declared larger stress workload.
Include ordinary scatter, structured/collinear sites and near-degenerate numeric
cases. Record runtime identity, warmup, repetitions, elapsed observations, memory or
allocation evidence and output checksums. Preserve a witness for failures. Budget
exhaustion must halt at the exact shared step. Root will assess cost and may request
output-preserving optimization before accepting this capability.

The implementation handoff does not establish FacetMarks drawing, artist workflow,
packaging, other-language support or full-corpus reproduction. Those follow after
native core acceptance. No Processing render is delegated with this task.

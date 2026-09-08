# Retained recipe session: first Java prototype contract

Status: root architecture for a bounded implementation; no cache support accepted yet.

## Artist behavior and granularity

An optional RecipeEvaluator.Session evaluates the same recipe-edit workflow while keeping
one completed retain stage. FieldMarks palette/length/bars edits and PathMarks palette/
markLength/trace edits reuse geometry. Seed, count, spacing, steps or distance changes that
affect retain invalidate it. The existing static evaluate entry point remains fresh replay.
No per-binding incremental engine is needed to establish this behavior: cache the complete
retain stage as one unit. This trades some recomputation for a smaller, clearer first design.

Infer dependencies from expression structure, never starter names or handwritten parameter
lists. For get(ref(params), key), depend on that top-level parameter key. Traverse every
expression branch conservatively, preserving literal payloads as data. A bare params reference
outside that recognized access depends on the complete parameter object. Retain AST, operation
declarations and dependent parameter values comprise the cache key. Structural equality must
ignore JSON object order and preserve array order; keys/values must be detached from callers.
Whole-parameter fallback permits aliases without risking stale results. Nested parameter
objects depend on their whole top-level value in this first implementation.

Only the retain stage can be reused. Every environment expression and frame statement runs
again with current params. Retained scopes must not preserve the previous params binding.
Retained instances are the current four immutable operation types; no future mutable operation
may enter this cache without a separate lifecycle decision. Returned command/result ownership
remains unchanged. Cache contents and runtime objects never enter recipe JSON or exports.

## Ownership and failure

Session is explicitly single-threaded, contains at most one cache entry, and has clear().
Keep detached keys and detached read-only retained data; immutable operation instances may
be shared internally. The cache never exposes its scope or instances to the caller.
On a key miss, evict the old entry before starting reconstruction to avoid retaining two
large geometry stages. Publish the new cache only after the complete frame succeeds. A
failed miss leaves the cache empty; a failed hit leaves its existing geometry usable.
Do not publish partial commands, retained scope or a new entry after failure.

## Resource semantics

Keep existing work/call/visit/iteration counters as actual evaluation charges. Cache reuse
must not pretend to execute constructors again. Record retainedReused separately in the
result, and expose retained-stage executed calls so tests can demonstrate actual skipped work.

A cache retains memory even when it saves computation. Add an explicit retained-value
reservation at warm evaluation start, before frame work. Use a conservative upper bound:
all retain-stage created value units plus the full detached cache-copy cost. Record that
reservation separately; charge it against the existing valueUnits capacity for the request.
Warm valueUnits therefore means reserved retained capacity plus newly created frame values,
not solely fresh allocation. Cold caching also charges its detached copy before allocation.
Native-array maxima from retain must be checked against the current host arrayLength on a
hit. Host budgets are snapshotted every call; changed limits cannot bypass cache admission.
Operation/work/visit budgets apply to actual current work, so a warm run can legitimately
fit a work budget that a cold run exceeds. Never raise default limits to make caching pass.

Key analysis/copy and cache-copy traversal need bounded visits/depth/size, using the existing
static JSON bounds and host visits. Do not introduce unbounded hashing or a global cache.
Elapsed limits remain fresh per call. Count implementation bookkeeping separately from recipe
value units as already specified; retain memory is the additional explicit reservation.

## Acceptance cases before any support claim

Compare session and fresh commands exactly for both complete compositions, including baseline,
style-only edits, geometry edits and reverted edits. Verify a warm style edit executes no
retain-stage operation calls, while seed/count/distance edits reconstruct. Change input objects
after the first run to prove detached key/value ownership. Cover bare-params fallback, changed
retain AST, failed geometry edit then recovery, failed frame on a hit, clear(), and lower warm
array/value budgets rejecting before frame work. Reuse the existing command runner and a small
focused probe; no new renderer or full render matrix is needed when commands remain exact.

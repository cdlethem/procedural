# Internal frame state and native surface ownership

Root resolution after Sol investigation, 2026-09-07. This specifies internal integration
for the reviewed [drawing contract](../catalog/drawing/fresh-raster-2d.json). It is not a
new public API, generic recipe executor or claimed native implementation.

Portable state retains only lifecycle state, a private immutable validated environment,
exact command count and a pending identity token. It never retains a renderer, surface
or integration callback. A native adapter owns a surface lease alongside portable state.

| internal operation | portable responsibility | adapter responsibility |
|---|---|---|
| prepare begin | Require new state; validate/detach environment; issue begin token | Preflight complete profile, acquire surface, verify readiness, initialize background/state |
| activate / fail begin | Resolve matching token; become active or aborted with phase-specific error | Release any acquired lease on failure |
| prepare batch | Require active with no pending operation; check container/count limits; fully normalize each record in order; return bounded immutable slots and base index | Make no native call unless the complete batch validated |
| commit / fail batch | Commit input count only after success, or abort with absolute source index | Visit slots in order, skip no-ops; release lease after failure |
| prepare / complete / fail end | Require active; resolve end token to completed or aborted | Finalize surface, then transfer on success; release on failure |
| abort | Idempotently abort unfinished frame; reject after completion | Release optional owned lease exactly once |

Each prepared batch includes one slot per input record, including no-ops and their source
offsets. Slots are detached and immutable, and exist only through synchronous resolution.
Do not retain completed batches. The count checks `count <= MAX - inputCount` before
addition, using Java long, Python int or JavaScript safe integer. Empty batches do not
advance count. The test-only boundary hook remains outside ordinary runtime entry points.

Pending tokens are identity-based and internal, not serializable recipe values. A stale,
foreign or twice-resolved token cannot advance state/count or transfer ownership. Reject
concurrent/reentrant operations while a token is pending. Any invalid operation on an
unfinished frame aborts it; completed remains completed. These transient phases do not
add public lifecycle states beyond new, active, completed and aborted.

A synchronous drawing error carries the original input offset plus batch base, even
when earlier no-ops made the emitted-command ordinal different. Initialization/end
errors carry null. Adapter exception wrapping must capture the slot's original offset
before invoking/advancing native drawing, since portable state cannot reconstruct it
from a host exception. Asynchronously detected loss carries an index only when the host can
identify the in-flight command; otherwise null. Failed native execution does not commit
the batch count and cannot return a completed surface.

Every adapter catch/finally path must resolve or abort pending work and release its lease
if still owned. Successful completion transfers ownership to integration, so later
adapter abort must never dispose a completed surface. The pure state machine reports
errors and transitions; it does not perform native cleanup itself.

Test the production state implementation against the 21 shared lifecycle scenarios,
with additional internal tests for stale/double/foreign tokens and prepared-slot mutation.
Model/fake event tests establish state semantics only. Actual cleanup, drawing and context
behavior still require the registered native tests on each backend.

Implementation review, 2026-09-07: production Java, JavaScript and Python state now pass
the shared scenarios and direct token/immutability regressions. Sol's final independent
review found no remaining blocker in corrected Python and root's replacement Java
implementation. Corrections cover snapshot mutation, exceptions after reservation,
reentrant state misuse, no-op failure indices and clearing retained environments.
This approves proceeding to native adapter tests; it does not certify surface cleanup
or rendering on any host.

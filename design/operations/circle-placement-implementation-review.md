# Root review: Java circle placement

The Java core is accepted for native workflow integration. This is root's direct review
during the Java-first buildout sprint; external reviews are paused. It does not yet claim
an installed native workflow, Android execution or another language implementation.

The implementation has one ordered acceptance kernel and one immutable retained result.
Explicit filtering completes static validation before retained allocation or pair work.
Seeded placement uses a private per-call stream, consumes four units per proposal and
tests each proposal before generating the next. Rejection skips later pairs. Dynamic
arithmetic failure exposes the specified proposal index/stage and returns no partial result.

Root required and verified these implementation corrections:

- `strictfp` covers the mapper and nested pair kernel in Java 8 bytecode. The current
  Java 17 runtime's implicit strict behavior alone would not establish that property.
- One reusable proposal carrier replaces a fresh object per attempt; zero attempts
  returns after static validation without constructing a stream.
- The dynamic exception is named `PlacementArithmeticException`, distinct from Java's
  general arithmetic exception. Validation and access errors retain their catalog codes.
- Native tests exercise nested and outer input/output detachment, original source-index
  copies, numeric carriers, nonfinite values, index precedence and destination preservation.
- Performance timing covers the retained kernel. The full geometry checksum runs after
  timing, and allocation measurements distinguish kernel work from checksum materialization.

Root ran the final self-contained Java conformance tool and published
[circle-placement-java.json](../../evidence/conformance/circle-placement-java.json).
It binds the exact sources, contracts and fixtures before and after execution. All 68
shared cases, five seed/state streams, five direct mapper vectors, accepted-prefix checks
and explicit-filter equivalence passed. The mapper vectors distinguish fused arithmetic
and reassociated multiplication; the streaming case distinguishes cross-candidate failure
precedence. Native access and ownership checks passed.

The bounded workload observations cover zero, one, 5,000, 10,000 and 200,000 proposals.
Retained payload counts exclude array headers and transient growth storage; timings are
observations on the recorded Java runtime, not universal guarantees. Forced heap exhaustion
was not executed and is explicitly reported as untested. Source review confirms that
allocation failure cannot expose a partially successful retained result or mutate an
existing result during materialization.

Next acceptance is the actual editable Processing sketch and local installed JAR:
placement edits rebuild geometry; motif/palette edits preserve it; authored radial input
uses the same filter; saving preserves the displayed canvas. Other target ports remain
explicitly deferred.

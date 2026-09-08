# Gradient path implementation review

Root accepts the three portable cores for public-example integration. Native renderer,
Android execution and reproduction acceptance remain separate and incomplete.

`evidence/conformance/gradient-path.json` binds the frozen contract, shared fixture,
independent long-case source, current implementations and native runners. All 32 short/error
and 20 long cases pass in Java, JavaScript and Python. Named-case tolerances remain those
approved by Sol; no universal cross-target identity is claimed.

Sol independently reviewed Java's static validation order, separate binary64 arithmetic,
query feedback, error stages, ownership and native surface. Native checks add 106 normal
assertions and nine bounded resource assertions under a 32 MiB heap. A failed materialized
export leaves the retained path usable; the maximal valid descriptor fails as a host memory
error rather than an invalid input. Benchmarks cover 1, 2000 and 16000 steps with explicit
inputs, repeated timings, output checksums and scoped allocation observations.

Root read both other implementations and assigned reciprocal read-only reviews. This caught
incorrect JavaScript provenance, missing explicit product-finite checks and evidence-runner
gaps. These were corrected before the accepted aggregate run. Python and JavaScript native
checks cover detachment, buffers/access order, replay/positive zero, carriers and resource
errors. Runner provenance rejects stale fixture/long-source bindings. Python records its
array-to-immutable-bytes copy and separately measured construction peak; final raw payload
must not be presented as peak memory. JavaScript records individual workload timings and
raw payload, explicitly not peak memory.

The public operation removes feedback integration while keeping movement independent of
marks and rendering. Its initial field is explicitly the existing gradient field, not a
simplex reproduction. No additional defaults, artistic ranges, callback protocol or source
composite merge is introduced by implementation. The next acceptance gate is the actual
editable public example on each claimed native target.

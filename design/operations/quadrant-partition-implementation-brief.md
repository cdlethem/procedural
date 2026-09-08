# Java quadrant partition implementation handoff

Root owns integration and review. This brief is preparatory: do not implement until the
catalog and distinguishing fixtures are reviewed/frozen. Sol review remains paused and
CP4 delivery is Java-first. Later ports consume the same contract and fixtures.

## Files and separation

The sole new public operation is `org.procedurals.layout.QuadrantPartition2D.generate`.
Its retained immutable result exposes bounds and creation IDs; no rendering, palette,
content callback, tree/history or mutable refinement API belongs in the class. Keep the
explicit-grid transfer in editable example code. Preserve all existing operation source
files and CP1/CP2/CP3 artifact evidence unless a deliberate shared-core change is reviewed.

Use one self-contained Java core source, native fixture runner and evidence tool for this
slice. The core implementation must not import its fixture generator. Native output must
bind exact contract/fixture/source hashes before and after execution and record runtime.
Match the existing Java numeric carrier and error conventions without adding aliases.

## Storage and work

A straightforward first implementation uses parallel packed double endpoints and integer
creation IDs. Removing a selected parent shifts the later active range; appending children
and assigning monotonic IDs produces the specified final order. Internal removal may precede
append when the observable sequence and failure behavior are identical. No public observer
sees partial construction. Reuse primitive work variables and grow capacity deliberately;
do not allocate four leaf objects on each replacement.

This version has quadratic worst-case element movement. Report it honestly and measure
100,200 and larger representative replacement counts. Do not promise linear work. Final
indexed traversal must be constant time, with allocation-free boundsInto. Final owned arrays
may be compacted once; distinguish active retained payload, spare capacity, headers and
transient growth/compaction when recording memory observations. Timing excludes checksums
and materialized copies. Skip forced-heap-exhaustion claims unless actually tested.

Sorted creation IDs are an invariant of append/remove ordering. Do not add a redundant
sorting pass or use swap-with-last removal. The generator's final leaves are not a prefix
under count extension: unchanged *surviving* cells preserve IDs and bounds, while selected
parents disappear. Test this explicitly.

## Numerics and failure

Compile for Java8 with explicit strictfp so portable binary64 semantics do not depend on
Java17's implicit strict behavior. Use the frozen xoshiro/Two-SplitMix64 expansion with
exact uint32 wrapping. Do not use Processing/JavaRandom or a style stream. Zero count
performs static validation and returns the root without RNG initialization.

Validate all fields and root endpoint/span representability before output-sized allocation.
Root failures are INVALID_RECTANGLE, including countzero. A positive but unsplittable root
is valid at countzero. For each requested replacement, consume one unit, select the ordered
leaf, check x midpoint and then y midpoint; dynamic failure returns no partial result.
Preserve stored shared endpoints through splitting and all four coordinates through native
transport. No broad epsilon, midpoint clamping or hidden skip threshold.

## Native acceptance

Run all shared cases, exact bound bits/IDs, seeds and native ownership/access failures.
Verify bytes emitted for a large finite midpoint whose naive endpoint sum overflows and
a midpoint whose reassociated arithmetic differs by one representable value. Invalid index
precedes out-of-range, which precedes destination validation; failure changes no output slot.

Then implement an ordinary editable RegionMarks Processing sketch around the actual public
operation. Seed/count/selection edits regenerate; motif/palette edits retain geometry; an
ordinary explicit-cell arrangement replaces generator output in the content example. Save
the displayed cached canvas. Use the registered private investigation as technique evidence,
not as an exact public-stream golden image. Define actual public native states before the
run, serialize rendering through the shared executor, inspect its images and package Java
only after acceptance. Do not batch ports before the next selected Java capability.

# Tapered field bodies: reuse the current path operation

Root architectural review, 2026-09-08. Direction for a bounded composition, not native
acceptance or a new operation contract. Grounding: `cp21-gap-source-bindings.json`,
`survey/out/2018/Generativos/peces/notes.md`, and the source body update/drawing methods.
Root reread the source and `packages/java/src/main/java/org/procedurals/paths/GradientPath2D.java`.

## Artist entry point

Move a head through a field, reconstruct a spine backward from its current position, and
apply a supplied width profile to draw a tapered body. A spine is the current field trace;
it is not a chronological trail. The source clears its points and angles every update.
Lifetime opacity/width, palette phases and head movement are separate authored policies.

## Existing capability and deliberate boundary

`GradientPath2D.trace` already retains point positions and the heading used at each step.
Its `angleBase` plus `angleScale * field.sample(...)` mapping can express a backward trace
by shifting the heading base by PI. No negative step length or new integration operation is
needed. `pointInto` and `headingAt` expose the geometry for a different drawing treatment.
For N spine samples with a heading at every sample, request N steps and draw samples0..N-1;
the terminal point has no stored outgoing heading and must not be indexed as though it did.

A drawing layer can place two vertices around each sampled point using its supplied heading
normal and an authored width at that sample. This is a sampled strip, not a geometric path
offset with guaranteed joins, caps, no self-intersections, or preserved width around corners.
The two sides traverse opposite sample orders. A head disk and per-vertex color treatment
remain ordinary drawing. Do not admit a generic ribbon-offset API from this composition.

This supports reuse of the package's own gradient field. It does not accept an arbitrary
external field callback or reproduce Processing's float/noise/RNG semantics. Source pixel
recreation remains unclaimed. An arbitrary supplied-field abstraction would require its own
motivating evidence and ownership/determinism contract; it is not silently included here.

## Next bounded demonstration

After current native acceptance, prepare one independent editable workflow using existing
path/noise/palette operations. Keep head count and spine count bounded, advance one explicit
logical tick at a time, and reconstruct spines from current heads. Demonstrate width-profile
and drawing changes while retaining the same spine values, followed by a head-motion tick
that recomputes spines. Reset must replay both geometry and pixels. Use mature, nonzero-width
states for visual review: the survey's early-frame all-none experiments cannot establish
useful width, lifetime or motion ranges. Any constants are authored example settings.

Before accepting, inspect a tapered-body render and a centerline transfer from the same
points. Measure the actual bounded recomputation workload and avoid per-vertex allocation.
No history-buffer operation, agent engine, new core entry, or full-source recreation is
admitted by this direction. If the composition reveals an actual algorithmic gap, record
that gap before changing a public contract.

# Motifs and moving relationships

The first implementation batch follows A and the first narrow slice of B in the
[external-art expansion plan](external-art-p5-expansion-plan.md). It adds original editable
p5 studies and two reusable computations. Other languages remain separate work.

Use the [motif guide](motif-compositions.md) for a botanical poster, an asymmetric geometric
panel and an orbital drawing. Replace marks and palettes while keeping their arrangements.
Use [moving relationships](proximity-interactions.md) for current proximity networks,
recorded movement trails and a fixed-edge graph substitution.

| Artist task | Package computation | What remains in the sketch |
|---|---|---|
| Connect nearby marks | `radiusPairs2D` returns deterministic original-index pairs inside an inclusive radius | Initial positions, drawing, palette and the meaning of a connection |
| Let connected points attract and avoid crowding | `pairForceStep2D` advances a supplied graph synchronously and returns positions, velocities and force sums | Initial state, graph selection, logical tick loop, bounded history and marks |
| Change a poster's motifs without rebuilding its layout | Existing circle placement, regular grid and polyline resampling, plus the default palettes | Original motif drawing, scale hierarchy, crop and composition |

The two new operations are separate so either can be replaced. A static proximity drawing
needs no simulation. A fixed graph can drive the same force step without a proximity query.
Neither operation reads p5 state, a clock, a renderer or randomness. Both return detached
values and enforce an explicit work budget.

The radius query uses a sorted x sweep. A dense or vertically aligned population can still
require quadratic candidate work; the budget is not a millisecond limit. The force step
uses a documented unit-mass attraction and tapered repulsion law. Coincident points do not
receive an invented direction. Damping is per invocation, and viewport clipping is not a
physical wall. The examples bound both agent population and history length.

These are original studies motivated by the collected references. They do not recreate
Davis or Reas artworks. In particular, movement trails do not supply Process 18's retained
pair-contact opacity, and reciprocal pair forces do not supply Tissue's sensor–motor wiring.
No new demonstrated-original coverage is claimed.

[Root integration review](../evidence/expansion/first-batch/root-review.json) records executed
checks, visual inspection, installed-package replay and limitations. The local
[visual gallery](../.work/visual-review/index.html) links the reviewed outputs in place.

Next, the plan calls for width-aware strip occupancy and elastic curve growth. Those need
separate contracts for valid strip regions, connected rest lengths, bending and controlled
splitting. This batch supplies a useful neighbor query but does not silently implement those
remaining algorithms. Persistent pair history and the broader fluid, typography, media,
3D and specialized systems remain later stages of the plan.

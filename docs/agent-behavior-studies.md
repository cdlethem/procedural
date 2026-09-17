# Links, sensing and flock marks

Make connections linger after marks separate, bend trails through a scalar field, or steer
points along a supplied graph. These are three separate computations, so the source of
neighbors, the field and the drawing treatment stay editable.

Run `node tools/serve_external_expansion_studies.mjs` and open one of the example URLs it
serves: `/examples/lingering-links/`, `/examples/sensing-trails/` or `/examples/flocking-marks/`.
Each starts paused; One tick advances explicit state, Play repeats that same step, Reset
restores the authored starting state and Save PNG captures the displayed canvas.

| Study control | Canvas effect |
| --- | --- |
| Lingering Links — Radius | Changes which current point pairs qualify as neighbors; old links can remain temporarily. |
| Lingering Links — Linger | Changes how many absent steps a retained link survives before disappearing. |
| Sensing Trails — Field | Supplies a different scalar grid to the same moving agents. |
| Sensing Trails — Gain | Changes the agents' turning response to the paired field samples. |
| Flocking Marks — Graph | Substitutes explicit neighbor edges while retaining body positions and velocities. |
| Flocking Marks — Marks | Restyles the same retained motion without recomputing its graph or forces. |

In [Lingering Links](../packages/javascript/examples/lingering-links/sketch.js),
`radiusPairs2D` produces current pairs and `contactHistory2D` retains them by caller-owned
IDs. Keep an ID when reordering a point; use a fresh ID for a new identity. The returned
active and missing counters are data, so opacity and stroke-width curves remain yours.

[Sensing Trails](../packages/javascript/examples/sensing-trails/sketch.js) passes an
explicit row-major field to `sensorMotorStep2D`. The field origin is the first cell center;
its spacing and clamp/wrap/zero sampling policy are explicit. Headings are in turns, with
positive rotation toward increasing y. Replacing the field does not deposit marks into it
or diffuse it: coupled field feedback is a separate workflow.

[Flocking Marks](../packages/javascript/examples/flocking-marks/sketch.js) uses
`flockSteer2D` to compute old-state cohesion, alignment and separation vectors. It returns
steering, not positions; the example's Euler motion and visible trails are editable code.
There are no implicit walls, collision solver or neighbor search. Graph edges can instead
come from a proximity query or another supplied topology.

The examples' values are authored compositions, not recommended parameter ranges measured
from an artist's source. Their [capability brief](../design/capabilities/agent-behaviors.md)
links the external motivations and operation boundaries.

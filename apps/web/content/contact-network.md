# Contact network

Three point neighbourhoods expose their current nearby relationships. The frame at each tick is recomputed from the same explicit initial state, so a style change can redraw it without advancing time. This is an original study, not a recreation of a surveyed artwork.

| Control | Canvas effect |
| --- | --- |
| Ticks | Advances the supplied synchronous force step from the initial arrangement. |
| Radius | Changes the current proximity graph and the graph used by later ticks. |
| Avoidance | Changes short-range separation in later force steps. |
| Open chains | Replaces proximity edges with three supplied open chains. |
| Dot marks | Changes the marks drawn over the retained state. |

The adapter composes `radius-pairs-2d` and `pair-force-step-2d`; it does not add collision, boundary, sensor, or contact-memory rules.

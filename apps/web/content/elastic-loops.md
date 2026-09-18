# Elastic loops

 Three open strands grow material rest lengths, change bend targets, and refine long edges. The bounded replay begins from the same pinned 30-node state and draws the returned noncrossing embedding.

| Control | Canvas effect |
| --- | --- |
| Ticks | Replays growth and midpoint refinement through at most 36 steps. |
| Growth | Sets the rest-length growth rate for new material. |
| Curl | Sets the signed bend-target rate; negative values reverse the authored curl. |
| Wind | Supplies horizontal external acceleration independent of growth. |
| Range | Distance within which nonincident strand segments push apart. |
| Strength | Force applied as two strands enter the avoidance range. |
| Structure | Reveals retained initial and split nodes without changing the material state. |

`elastic-curve-grow-step-2d` computes the material update and split events. Palette and structure visibility redraw the same computed state.

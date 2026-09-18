# Neighborhood growth

Twenty-six points on a loose spiral form an exact relative-neighborhood graph, then relax synchronously: each step pulls points along their eligible edges, and the graph is requeried after each step unless an explicit chain is chosen. Growth extends the same loop with the Differential Lattice coupling: after each relaxation a fixed 196-point proposal pool is scanned, and a candidate joins the web when its count of existing points within the 70px density radius falls inside the Min/Max neighbors interval. New nodes enter the exact graph on the next tick, so relaxation and insertion structure each other.

| Control | Canvas effect |
| --- | --- |
| Ticks | Replays graph queries, point displacement, and node insertion. |
| Open chain | Supplies fixed adjacent-index edges instead of querying the neighborhood; the chain follows the growing point set. |
| Length threshold | Changes which edges contribute to later displacement. |
| Step | Sets how strongly eligible edges move points per tick. |
| Insert | New nodes appended per tick from the fixed proposal pool; 0 keeps the 26-point web fixed. |
| Min neighbors | Fewest existing points within the density radius a candidate needs; 0 starts growth in empty space, 1 propagates from the web only. |
| Max neighbors | Most existing points within the density radius a candidate may have; low values keep growth sparse, high values cluster it near the web. |

Faint spokes connect each seed point to its current position, showing accumulated displacement; seed points keep their dark tone while inserted nodes use the pale slot, so new material reads apart from the original web. Point radius reflects graph degree for both populations. `relative-neighborhood-pairs-2d`, `threshold-edge-relaxation-2d` and `radius-pairs-2d` do the graph, motion and density-counting work. The pool, the 70px radius, a 48-candidate judgment cap and a 96-point cap are fixed: measured execution bounds of the exact O(N³) query, not artistic choices. The adapter adds no collision handling, boundary constraints, or hidden spring force.

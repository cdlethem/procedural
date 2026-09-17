# Neighborhood growth

Twenty-six points form an exact relative-neighborhood graph, then relax synchronously along edges longer than a threshold. The graph is requeried after each step unless an explicit chain is chosen.

| Control | Canvas effect |
| --- | --- |
| Ticks | Replays graph queries and point displacement. |
| Open chain | Supplies fixed adjacent-index edges instead of querying the neighborhood. |
| Length threshold | Changes which edges contribute to later displacement. |
| Large marks | Enlarges the drawn points without changing their positions. |

`relative-neighborhood-pairs-2d` and `threshold-edge-relaxation-2d` do the graph and motion work. The adapter adds no collision handling, boundary constraints, or hidden spring force.

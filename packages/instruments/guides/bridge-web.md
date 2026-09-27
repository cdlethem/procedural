# Bridge web

Construct a family of parallel strands, then let each candidate cross the current graph. Every accepted insertion splits existing edges and links one selected gap; split children keep their parent's strand or bridge kind and IDs remain stable. A seed shapes the shared curvature, the bounded strand deviations and the candidate offsets, without scrambling the original strand order.

| Control | Canvas effect |
| --- | --- |
| Strands / Strand joints | Choose the number of lanes and the resolution of their source paths. |
| Source span / Strand spacing | Independently set the source's longitudinal length and distance between neighboring axes. |
| Source X / Source Y / Source direction | Place and rotate the construction without fitting it to the page. |
| Common bend / Strand disorder | Shape a shared seeded wave, then vary individual strands by less than their separation. |
| Bridges / Bridge spacing / Bridge start | Replay candidates at controllable distances and offset from the source's beginning. The schedule must fit inside its source span. |
| Candidate disorder / Slant | Jitter candidate position within its schedule or tilt the crossing in either direction. |
| Stride | Select successive gaps modulo **Strands − 1**; a shared divisor visits fewer distinct gaps. |
| Strand weight / Bridge weight | Independently tint and size source and inserted edges; zero removes that set of strokes. |
| Node marks / Node diameter | Optionally draw current graph joints even when edge weights are zero. |
| Candidate guide | Preview the next candidate without changing any insertion; off by default. |

Try **a local comb**: 3 strands, 4 joints, span 160, spacing 26, 3 bridges, source center (200, 240), and modest bend. For **woven diagonals**, use 8 strands, 8 joints, span 480, spacing 46, direction 135°, 13 bridges, negative slant and a stride relatively prime to seven. Palette and mark edits do not re-seed the graph. Dense node/edge/step combinations are rejected before replay; malformed source geometry is not silently repaired. `insert-segment-bridge-2d` owns intersection, split and link semantics. This is not an automatic face finder or road planner.

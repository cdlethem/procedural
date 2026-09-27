# Elastic loops

Start from seeded ordered open filaments or concentric closed loops, then grow their actual rest lengths and bend targets. The material update can move and refine nodes while preserving a noncrossing embedding. Initial overlapping or intersecting geometry is rejected before replay, not automatically fixed.

| Control | Canvas effect |
| --- | --- |
| Sources / Source joints / Source topology | Choose the number, resolution and open versus closed connectivity. Closed loops have a closing edge and a turn at **every** vertex. |
| Filament length / Inner radius / Source separation | Set the open span or innermost ring radius, and separately space adjacent sources. |
| Source bend / Source disorder | Shape a common seeded wave with bounded individual variation. Ordered open filaments and nested rings remain separate initially. |
| Source X / Source Y / Source direction | Place and rotate the source, without automatic fitting or a panel. |
| Pinning | Anchor none, first nodes, or both ends of open filaments; for rings “both” anchors the first node. |
| Ticks / Growth / Curl | Advance material, grow rest lengths and turn bend targets in either signed direction. |
| Horizontal wind / Vertical wind / Avoidance range / Avoidance strength | Combine external acceleration with nonincident-segment repulsion. |
| Refinement length / Node cap | Split edges longer than the limit while limiting total retained nodes. The cap and ticks share a work budget; an insufficient cap for actual splits raises an error. |
| Line weight | Draw the final curves with one independent weight; zero hides every line, including optional seed guides, but not optional nodes. |
| Seed guides / Structure nodes / Endpoints / Node diameter | Independently show the original geometry, retained nodes and open endpoints (or ring start points). Guides and nodes are off by default. |

For **a narrow moving fringe**, use 2 open sources, 5 joints, length 130, separation 28, a center near (170, 310), ticks 5, slight negative curl and vertical wind. For **nested eddies**, switch to ring, 2 sources, 9 joints, inner radius 55, separation 46, pinning none, growth .02 and a low line weight. Appearance changes do not re-run the source or dynamics. `elastic-curve-grow-step-2d` performs growth, forces, refinement and noncrossing motion; the adapter supplies real measured initial rest lengths and turns rather than authored ten-node paths.

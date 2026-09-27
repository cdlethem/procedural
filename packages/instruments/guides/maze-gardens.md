# Lattice Forests: Maze Garden starting recipe

Lattice Forests builds a local four-neighbor lattice, removes seeded blocked sites, and runs `seededDepthFirstSpanningTree` separately on each connected island. The Maze Garden starting recipe begins with a dense maze-like grid; Branching Network starts with a sparser edge network. Both draw a **DFS forest**, not a uniformly random spanning tree. No bridges are invented across holes, no automatic page fit or background is drawn.

## Work with the source

- **Columns / rows** determine potential sites; **cell spacing** fixes the actual distance between them. **Center X/Y** and **orientation** move and rotate the source without changing connectivity.
- **Region** keeps a rectangle, disc, or annulus. **Annulus hole** is the fraction of the outer radius removed; **blocked sites** independently removes a seeded fraction of surviving sites. All remaining four-neighbor connections are candidates.
- **Root X/Y** prefer a site in normalized full-lattice coordinates. The nearest surviving site roots its component; other components root at their own nearest site in deterministic order.
- **First / last depth** reveal only a portion of each DFS tree. **Branch retention** drops visible edges without adding edges. **Edge weight** and independently switchable **site marks / dot diameter** control appearance. Zero weight hides edges, not sites.
- Seed changes blocked-site placement and DFS traversal; palette changes only colors. No directional traversal-bias control is offered: the core operation samples DFS neighbors with its own RNG, not weighted adjacency.

## Control map

| Controls | Canvas effect |
| --- | --- |
| Columns, Rows, Cell spacing | Set the number of possible junctions and their fixed distance apart; more sites extend the maze rather than fitting it to the page. |
| Center X/Y, Orientation | Translate and rotate the same source lattice around its center without rewiring the forest. |
| Region, Annulus hole, Blocked sites | Clip eligible sites to a rectangle, disc, or ring, then make seeded holes that can split the graph into islands. |
| Root X/Y, First / last depth | Choose the preferred surviving root and expose a discovery-depth interval in each island's DFS tree. |
| Branch retention, Edge weight | Thin the painted tree edges and change their stroke thickness; neither adds a connection. |
| Site marks, Dot diameter | Show discovered sites independently of strokes and set their visible size. |

## Contrasting recipes

1. **Closed maze:** rectangle, 16 × 16, spacing 19, blocked 0, root (.5,.5), depths 0–8000, branch retention 1, edges weight 3, sites on. This is one full spanning tree.
2. **Island paths:** disc, 29 × 29, spacing 12, blocked .28, root (.15,.65), depths 2–28, branch retention .7, site marks off. Multiple disconnected islands become independent trees rather than fake bridges.
3. **Ring shards:** annulus, inner radius .7, 31 × 31, spacing 15, blocked .1, first depth 8, last depth 35, sites on and edge weight 0: study only the selected site depths.

An empty retained region (including blocked fraction 1) reports an error rather than fabricating a graph. Site count and graph traversal are capped before source allocation; over-budget combinations fail clearly instead of silently shrinking columns or rows.

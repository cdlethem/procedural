# Branching Networks: Lattice Forests starting recipe

The Branching Network starting recipe opens Lattice Forests with a lighter site-and-edge treatment than Maze Garden. A source graph is made from retained sites of a local four-neighbor lattice. Each connected component is traversed by the portable seeded depth-first spanning-tree operation; the painted network is a forest, never a claim that a disconnected graph was joined. Its footprint is set explicitly with spacing and center.

## Controls

**Columns / rows**, **cell spacing**, **center X/Y**, and **orientation** determine the source geometry. **Region** rectangle/disc/annulus and **annulus hole** select sites; **blocked sites** makes seeded holes. **Root X/Y** select the closest retained source site in normalized full-lattice coordinates. **First / last depth** crop the traversal by discovery depth, while **branch retention** independently exposes a seeded subset of its edges. **Edge weight** and **site marks / dot diameter** let you inspect topology without lines, marks without edges, or vice versa. The background is transparent; there is no forced frame.

Changing the seed changes holes and traversal, not the source placement or color palette. There is no fake directional bias parameter: the core DFS chooses neighbors without a weighted-tree distribution. Depth restarts at zero for each disconnected island, ordered first by the component containing the preferred root and then by the site's source index.

| Controls | Canvas effect |
| --- | --- |
| Columns, Rows, Cell spacing | Expand or contract the set of potential sites at a fixed pitch, without automatic page fitting. |
| Center X/Y, Orientation | Move or rotate the source while preserving its local four-neighbor topology. |
| Region, Annulus hole, Blocked sites | Shape the retained area and cut seeded holes; disconnected islands remain separate. |
| Root X/Y, First / last depth | Prefer a surviving root, then show only the chosen discovery depths in each tree. |
| Branch retention, Edge weight | Seed-thin visible edges and adjust their stroke width, including hiding all edges at zero weight. |
| Site marks, Dot diameter | Switch discovered-site dots on independently of edges and size those dots. |

## Contrasting recipes

- **Vein study:** rectangle, 13 × 13, spacing 24, blocked 0, root (.5,.5), depth 0–8000, retention 1, weight 2 and site marks off.
- **Dry watershed:** disc, 27 × 21, spacing 18, blocked .32, root (.8,.1), depths 2–50, retention .45, site marks on at diameter 3.5. Detached basins retain distinct roots.
- **Radial fragments:** annulus, hole .6, 33 × 33, spacing 15, blocked .08, first depth 8, last depth 32, edge weight 1.2; move center and rotate without changing the graph.

If no sites survive, rendering reports an empty-source error. Combined site/traversal budgets reject oversized inputs before graph allocation.

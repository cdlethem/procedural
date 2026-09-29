# Graph Roles

Read one network in several roles at once: a thin supporting web that stays quiet, a bold
route between two places you choose, small motifs whose size follows how connected each node
is, and colour fills only in the regions that the edges genuinely enclose. The starting study
is a grown lattice maze with loops: hairline links tinted by age, a red route climbing from the
lower left to the upper right, dots that swell at junctions, and gold and blue tiles laid into
some of the small and large faces, leaving other faces and the margins open.

Each role is styled separately. Change the route's material without touching the network, thin
the network to almost nothing and leave the route standing alone, or hide the endpoints and keep
the fills. None of those edits moves a node: only the controls under **Network**, **Placement**
and **Roles** change the graph that is read.

## Choose the network

| Controls | What changes on the canvas |
|---|---|
| **Network** | **Contact** joins agents that end up within a radius of each other after a short drifting replay. **Lattice** grows a maze over a grid of sites, then adds loops and diagonals. **Branches** grows seeded trees from the bottom edge. |
| **Direction** | **None** treats links as undirected. **Source** keeps each edge's own orientation: chaser to chased in Contact (the agent closing faster), older to younger in Lattice and Branches. It enables arrowheads and lets the route follow direction. |

**Contact.** *Agents*, *Starting shape*, *Starting disorder*, *Contact radius* decide how many bodies there are
and how densely they touch; a small radius gives sparse queries, a large one gives crossing fabrics.
*Ticks*, *Attraction*, *Starting speed* and *Momentum* decide how far the network evolves before it is read:
contacts that have lasted the whole replay are old, ones that formed a moment ago are young, and pairs that
drift apart and return start counting again.

**Lattice.** *Columns*, *Rows* and *Region* (rectangle, disc or ring with *Ring hole*) set the sites. *Blocked
sites* removes some before growth, leaving holes and dead ends. *Loops* is the fraction of the grid edges
outside the spanning maze that are kept: 0 is a pure maze tree with no faces, 1 the full grid. *Diagonals*
adds cell diagonals; both diagonals of a cell cross each other, so those cells are never filled. *Wobble*
displaces every site inside its cell. *Growth origin X/Y* is where the maze starts, so edge ages count away
from it.

**Branches.** *Trees*, *Generations*, *Children per branch*, *Branch angle*, *Turn spread*, *Contraction* and
*Survival* shape the forest. Branch trees have no cycles, so they never have faces.

## Placement

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Width/Height** | The footprint. For Contact the width is the extent of the starting shape and the network may drift beyond it. |
| **Rotation** | Turns the whole network about its center. |

## Select roles

Filters pick which part of the graph the treatments see. Degree, weight and age are properties of the
whole source graph, so a node's degree does not change when a filter removes its neighbours.

| Controls | What changes on the canvas |
|---|---|
| **Fewest / Most links** | Keep only hubs (many links) or only leaves and thin places; **Most links** 0 means no limit. An edge needs both ends to pass. |
| **Weakest / Strongest edge** | Edges below or above this fraction of the strongest weight are dropped. Weight is closeness in Contact, a smooth seeded corridor field in Lattice, and the share of a tree's segments carried in Branches. |
| **Youngest / Oldest edge** | Edges younger or older than this fraction of the oldest age are dropped. |
| **Keep isolated nodes** | Shows nodes that lost every edge. Off by default so fragments read as fragments. |

## Route

The route is computed on the selected roles only, so a filter can close a road or open a detour.

| Controls | What changes on the canvas |
|---|---|
| **Route** | **Shortest** or **longest** simple route between the nodes nearest the start and end points, or off. |
| **Measured by** | **Length** (edge length), **hops** (edge count) or **weight** (strong edges are short, so the route prefers them). |
| **Start / End X/Y** | Canvas points; each selects the nearest node of the current selection. |
| **Follow direction** | With Source direction, the route may only travel tail to head, and may not exist. |

Equal-cost shortest routes are settled by an explicit rule: fewer edges first, then the route whose node
sequence is smallest in the graph's node order, so the same picture returns on every run. The longest route
is the hardest simple-path problem, so its search is bounded (100,000 expansions). It is exact on most graphs; on very loopy ones it keeps the best route found, which is still a
valid route and never shorter than the shortest.

## Draw the roles

| Controls | What changes on the canvas |
|---|---|
| **Route material**, **Route weight**, **Route spacing**, **Route bead**, **Bead size** | The bold focal route as ink, stitches or beads. Arrow beads point in the direction of travel. |
| **Show endpoints**, **Endpoint size** | Rings on the first and last node of the route. |
| **Edge material**, **Edge weight**, **Edge spacing**, **Edge bead**, **Edge bead size** | The supporting network, kept deliberately thin. |
| **Edge color** | One colour, or three colour bands by weight or by age. |
| **Edge retention** | Stable omission of edges, opening space without changing the network. |
| **Arrowheads**, **Arrow size** | With Source direction, a small arrow at every edge's midpoint pointing tail to head. |
| **Node mark**, **Node size**, **Size by**, **Size contrast** | A dot, ring or rosette on every selected node, scaled by degree, weight or age. Size 0 hides nodes; nodes on the route take the route colour. |
| **Fill faces**, **Face color**, **Face opacity** | Fills the enclosed regions. Colour by size bands small faces gold and large ones blue. |
| **Smallest / Largest face**, **Face retention** | Leave small or huge faces open, or omit faces at random but stably. |

### What counts as a face

Edges are drawn straight between node positions. An edge that crosses another edge, ends on the middle of
one, or overlaps one along a line is a *crossing edge*; it never bounds a face. Dangling chains are pruned.
The remaining edges are walked as a planar embedding, and a region is filled only when it is a simple polygon
of at least three nodes, with no crossing edge running through it and no other structure floating inside it.
A square with both diagonals is therefore not filled, while a square with one diagonal gives two filled
triangles. Direction never affects faces. Crossings are never turned into corner nodes.

## Try these

- Lattice, **Loops** 0 and **Growth origin** at a corner: a maze whose edge colours count the growth order;
  the route walks the only corridor between the two points.
- **Loops** 1, **Diagonals** 0.5, **Wobble** 0.15, rectangle region: a grid of filled triangles and squares
  with open X-shaped cells.
- Contact, **Ticks** 60, **Route** longest by hops, **Direction** source with arrows: chasing contacts and one
  long relay through them.
- **Fewest links** 3 on a dense lattice: only the junction skeleton remains.
- **Weakest edge** 0.4 with **Measured by** weight: the route follows strong corridors around weak country.
- Route material beads with arrow beads, edge material stitches, faces off: a stitched map with a marked trail.

## Use the pieces yourself

The graph, the selected view, the route and the faces are ordinary frozen values; each role is drawn by the
same `strokeWith` and `atEach` consumers as every other composition, so any callback can replace a role.

```js
import { createInstrument, referenceComposition, graphStructure, edgePaths, nodeSites, planarFaces,
  strokeWith, atEach, pathMaterial, motif } from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("graph-roles")); // a JSON descriptor
const { view, route } = graphStructure(recipe);
strokeWith(p, edgePaths(view), (p, path) => { p.stroke(40); p.line(...path.points[0], ...path.points[1]); });
strokeWith(p, planarFaces(view).faces, (p, face) => { /* face.points is a closed polygon */ });
atEach(p, nodeSites(view, { scale: (node) => 0.4 + node.degree * 0.2 }), motif(recipe.nodes.mark, recipe.palette));
if (route) strokeWith(p, [route.path], pathMaterial(recipe.focal.material, recipe.palette));
```

`graphFromParts({ seed, directed, nodes, edges })` admits your own graph: unique ids, edge weights in
[0, 1], positive integer ages, no self-loops or duplicate pairs. `contactGraph`, `latticeGraph` and
`branchGraph` build the three sources directly; `selectGraph` applies the role filters, `graphRoute`
finds a route and `planarFaces` extracts faces (work-bounded; it throws rather than answer partially).
The library does not create or clear a canvas, and lengths are canvas units.

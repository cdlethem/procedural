# Graph roles (brief 05)

Status: implemented on branch `w1/graph-roles`, not yet root-reviewed through the real interface.
Built on the frozen [reference slice](composition-reference-slice.md) and
[structural operators](composition-structural-operators.md) conventions.

## Artist-facing brief

Graph Roles reads one network in separate roles. A thin supporting web, a bold focal route between two
chosen places, node motifs sized by connectivity and colour fills only where the edges truly enclose a
region are edited independently. The sources are the existing contact-network replay, the lattice spanning
forest (with loops and diagonals added) and the seeded branch tree. A supplied graph enters through
`graphFromParts`. There is no query language, no mutation and no multigraph.

## Frozen boundary (`composition/graph.ts`, `composition/graph-draw.ts`)

- **Graph value.** `Graph { seed, directed, nodes, edges, stats }`, deeply frozen. Nodes carry `degree`,
  `weight` (sum of incident edge weights) and `age`; edges carry `weight` in [0, 1], `age` (positive
  integer source steps), `length`, and a stored `from → to` orientation. `graphFromParts` validates ids,
  endpoints, self-loops, duplicate unordered pairs, weights and ages, and bounds work
  (`MAX_GRAPH_NODES` 20,000, `MAX_GRAPH_EDGES` 60,000).
- **Attributes by source.** Contact: weight = closeness `1 − d / radius`; age = consecutive ticks in
  contact ending at the last tick (a pair that separates and returns starts again). Lattice: tree edges run
  parent → child, other edges older → younger; birth is the child's depth (tree) or the deeper endpoint's
  depth, age = last birth − birth + 1; weight is smooth seeded value noise at the edge midpoint. Branches:
  weight = segment's share of its tree, age = last generation − generation + 1. A node's age is its oldest
  incident edge.
- **Ids and seeds.** `a:<i>`, `e:<a>:<b>`; `n:<col>:<row>`, `e:<A>|<B>`; `t<k>:o`, `t<k>:<segment>`,
  `t<k>:e<segment>`; faces `face:<node ids ccw from the smallest id>`. Every seed is
  `componentSeed(graph seed, id, purpose)`. Palette, material, tone, filters, route and direction never
  change ids, positions or seeds. Blocked lattice sites use the existing sequential stream, so resizing the
  lattice may rename ids (the frozen rule for topology-changing edits).
- **Direction.** Producers always store their natural orientation (contact: the agent closing faster is the
  tail, ties to the lower index; lattice and branches: older → younger). `withDirection(graph, flag)` changes
  only the flag, so direction adds arrowheads and route constraints and moves nothing.
- **Roles.** `selectGraph(graph, roles)`: degree (source-graph count), edge weight and edge age (fractions of
  the graph maxima) filters; an edge needs both ends kept; isolated nodes are optional.
- **Routes.** `graphRoute(view, options)`; shortest ties: fewer edges, then the lexicographically smallest
  node sequence in graph node order. Longest simple route is NP-hard, so the search is bounded (100,000
  expansions) and reports `exact: false` if it stopped early, returning the best route found (or the
  shortest). Endpoints are the view nodes nearest two canvas points (ties: earlier node).
- **Faces.** `planarFaces(view)`: crossing edges (proper crossings, endpoint on another edge's interior,
  collinear overlap) never bound a face, and a crossing never becomes a node; dangling chains are pruned;
  counter-clockwise faces of the rest are traced; a face is kept only if it is a simple polygon
  (not `pinched`), no crossing edge runs through it (`crossed`) and no other structure floats inside it
  (`island`). A square with both diagonals is not a face; with one diagonal it is two triangles. Faces are
  closed `Path`s, so `strokeWith` and any path material can consume them; `faceFill` fills the polygon.
  Work (cell insertions, pair tests, point-in-polygon tests) is bounded at 5,000,000 steps and throws
  rather than answering partially; pairs of edges already known to cross are skipped.
- **Consumers.** `edgePaths` (two-point paths, from → to), `nodeSites`, `edgeMarkers`, `faceFill`, all drawn
  by the frozen `strokeWith` / `atEach`. `referenceComposition` resolves the named instrument to a
  JSON-compatible `{ kind: "graph" } & GraphComposition`; `drawGraphComposition` and
  `prepareGraphComposition` consume it. Caches: source graph (LRU 6), view (source + direction + roles),
  route (view + route options), faces (per view), edge layers (view + tone); appearance edits touch none.

## Controls

Groups: Network (Contact, Lattice, Branches), Placement (proportional Size), Roles (Degree, Weight, Age),
Route (Start, End), Focal route, Support edges, Nodes, Faces. Only the chosen source's controls, route
controls when a route is on, material controls for the chosen material, and face controls when faces are on
are visible. `faces` is shown for contact and lattice only (a branch forest has no cycles). `Most links` 0
means no limit (the recipe stores 60,000).

## Verification

`tests/composition-graph.test.ts` (38 tests): exact attributes and frozen values; id-based seeds; lattice edge
counts, positions, rotation, parent → child ages; id/position stability under loops, direction and roles;
contact edges, weights, run-length ages (including pairs that separate and return) and pursuit direction
against the replay recomputed independently; branch weights and ages; role filters; route metrics, tie rule,
direction, absence, brute-force agreement with all simple paths on 24 random graphs, and the bounded longest
search; face topology cases (square, diagonal, wheel, X, concave L with a crossing in and beside it, pinch,
bridge, dangling chain, island, T-touch, overlap, coincident nodes), Euler count and tiling on a wobbled
lattice, no face pierced by any edge; work bound; descriptor equality, cache identity, separate edits of
support and route, endpoint toggle, seed declaration, validation limits. Mutations confirmed to fail tests:
skipping the crossed-face rejection (3 tests), picking the last instead of the first tie candidate (1 test),
not resetting contact run starts (1 test).

## Review record

Rendered defaults, three seeds and 30+ structural settings with a throwaway raster of the recorded calls
(images under `.work/`). Defects found and fixed: face fills used the ink colour and hid everything; the
"deep" edge band was indistinguishable from ink; `size` tint used linear area so almost every face was one
colour (now log-scaled); arrows were unreadable; contact defaults produced a static network with nearly equal
ages (added *Momentum*, retuned defaults); the default degree cap emptied dense contact networks (0 now means
no limit); face extraction stopped at its bound on dense contact clumps (already-crossing pairs are skipped);
the audit showed `faces` is irrelevant for trees (now conditional). Tests exposed a grid-origin bug in
crossing detection and a `near(x, −Infinity)` bug that disabled the longest search.

Open: the contact replay and dense face extraction run synchronously inside preparation (about 0.5 s at 120
agents, 120 ticks, radius 90); real-interface review, layering with other studies and responsiveness are not
done.

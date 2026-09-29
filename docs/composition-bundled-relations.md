# Bundled Relations (brief 41)

Status: **built on branch `w2/bundled-relations`, unreleased; reviewed from rendered SVG-surface output
only.** It follows the frozen [reference slice](composition-reference-slice.md) and
[structural operators](composition-structural-operators.md) conventions, the
[graph roles](composition-graph-roles.md) `Graph` value and the [data scores](composition-data-scores.md)
tables. It has **not** been operated through the real Studio interface, layered in the private app, or
timed in a real p5 canvas; those remain open items.

## Artist-facing brief

Make readable families of curves between real relationships instead of a decorative web. The instrument
takes weighted links between grouped places, lays the places out by an explicit rule, and routes every
link through shared waypoints **only when it joins the same two groups**. Bundle strength zero is the
declared unbundled layout: every link a straight segment between its two places.

- **Endpoints**: a ring or a line by category (the node table's category column), or the graph's own positions.
- **Bundles**: strength, hub depth, trunk lift, port separation, curve detail, and whether opposite flows share a bundle.
- **Selection**: scope (all / between groups / within groups), weakest flow, stable retention.
- **Direction and weight**: source→target colour split, optional arrowheads or arrow beads; five weight bands of stroke width or bead size.
- **Highlight**: every edge of a group, of a pair of groups, or the heaviest few, with a heavier material.
- **Compose**: edges use the existing `pathMaterial` (ink, stitches, beads), places the existing `motif`; both are
  replaceable by ordinary callbacks. The layer is transparent and layers over any other instrument in either order.

## Frozen boundary and semantics

Code: `src/composition/bundling.ts` (producer), `bundled-relations.ts` (recipe, cached stages, consumers,
named binding), `bundle-samples.ts` (datasets), `adapters/bundled-relations-instrument.ts` (definition).
No new graph type: `Graph` is used as is (`graphFromParts`, `selectGraph`, `nodeSites`, `nodeFraction`);
groups are a `GroupAssignment` (`groupOf[i]` for `graph.nodes[i]`).

- **Tables → graph.** `relationsFromTables(nodes, edges, columns, {seed, directed})`. Node ids are the
  node table's row ids, edge ids the edge table's row ids; the group column is categorical (a continuous
  column is refused, a missing group is an error naming the row); edge `from`/`to` are categorical over node
  ids; `flow` is a positive measure and edge weight is `flow / largest flow`. Errors name table, column and row.
  A graph is simple: one row per pair (net flow), no self-loops.
- **Layout (`layoutEndpoints`)** replaces positions only; ids, seeds, edges and weights are unchanged.
  `circle`: groups take sectors in declared category order, sized by node count or total flow (each node adds
  a quarter of the mean node flow so isolated places keep a slot), separated by `gap` (share of the turn);
  nodes take equal slots in `table`, `flow` (largest first), seeded `shuffled` (`componentSeed(graph seed, node id, "order")`)
  or `partners` order (weighted mean signed direction of the partners' groups). The ring is an ellipse of
  the frame; rotation is degrees about the center. `line`: the same along the frame's bottom edge, arcs rise
  up to the frame height. `graph`: keep the source positions (`fit: false`, exact) or stretch the bounding
  box to the frame. Empty groups take no place. The layout never depends on later edge selection.
- **Selection (`selectRelations`)** is the existing `selectGraph` (weights are fractions of the graph maximum,
  every node kept) narrowed by scope and by stable retention: an edge stays when
  `componentSeed(edge.seed, edge.id, "keep") / 2³² < retention`, so raising retention only adds edges.
- **Routing (`bundleEdges`)** — the stated algorithm: *family bundling by hierarchical waypoints*, force-free
  and deterministic.
  - A *family* is the set of edges joining the same two groups (`families: "pair"`, unordered) or the same ordered
    pair (`"directed"`, a → b and b → a separate; needs a directed graph). **Only edges of one family share waypoints;
    unrelated families share none.** A route depends only on its own endpoints, its family and the layout — not on
    other edges, their order, or the selection — so filtering or reordering never moves a path.
  - A group's *hub* is its anchor pulled toward the interior by `inset` (ring: toward the center; line: up by
    `inset × frame height`; graph: toward the centroid). Around the hub there is one *port* per other group
    (two, out and in, for directed families), ordered by the direction of the partner so neighbouring bundles do
    not cross at the hub, spread over the group's extent by `separation`. Ports are computed from the layout
    alone, so they never depend on which edges exist.
  - A family's *trunk* is the midpoint of its two ports moved toward the interior by `lift × half the port distance`.
  - Control polygon `[from, port, trunk, port, to]` (`[from, hub/2, to]` inside a group). Holten's straightening
    `P′ᵢ = β·Pᵢ + (1−β)·(P₀ + i/(n−1)·(Pₙ₋₁−P₀))` blends it with the chord by `strength = β`, and a clamped uniform cubic
    B-spline with `detail` samples per span is drawn through it. **β = 0 is exactly the two endpoint positions**
    (a special case, not float residue); the routed polyline is linear in β, and both ends are always the endpoint nodes' exact
    positions.
  - Cost: O(G² log G) for ports, O(E·detail) time and memory for paths. Determinism: no randomness and no iteration;
    IEEE double arithmetic only (`+ − × ÷ √ sin cos atan2`).
  - Output `BundledEdges`: `paths` (`Path` with `id` = edge id, `seed` = edge seed, `edge`, `from`, `to`, `fromGroup`, `toGroup`,
    `family`, `weight`, `length`, `tone = 1 + source group`), `bundles` (`id`, member edge ids, shared waypoints),
    plus the `layout` (with `placements`: group, anchor, extent, node order) and `view`.
- **Products** (`groupBands`, `pathMarkers`, `highlightedEdges`). Bands `band:<group>`; arrow sites `<edge id>/arrow` placed by
  arc length, turned along from → to, subset chosen by `componentSeed`, at most 400; highlight sets are computed from bundled paths.
- **Consumers.** Weight is encoded in five bands of `sqrt(weight fraction)`; each band is one `pathMaterial` whose width (ink,
  stitch) or bead size is scaled so the heaviest band keeps the authored value. The `flow` colour rule splits an edge at its
  arc-length middle into `<id>/from` and `<id>/to` (each keeps level and seed) coloured by source and target group. Draw order:
  bands, edges light to heavy, highlighted edges, arrows, places.
- **Stages and caching.** relations → layout → selection → bundles (→ highlight, drawing plan). Each stage is cached by construction
  (tables + seed + options that stage reads) and frozen; palette, materials, marks, tone rules and arrows never recompute a stage
  and cannot rename or move a path. A strength edit replaces bundles only; a scope/weight/retention edit replaces the selection.
- **Bounds (errors name the control).** `MAX_BUNDLED_EDGES = 5000` (`minWeight`/`retention`), `MAX_BUNDLE_VERTICES = 400,000` (`detail`),
  `detail ≤ 32`, and before drawing, stitch/bead work `MAX_MATERIAL_WORK = 80,000` units (`edgeSpacing`/`highlightSpacing`). Slider
  intervals stay well inside these; the hard limits are the ones that throw.

## Controls, conditions and groups

Groups: Relations (Selection), Endpoints, Placement (Size proportional: width, height), Bundling (Waypoints), Highlight (Bead mark),
Edges (Bead mark, Direction), Places (Group bands). Only `Size` is proportional (two lengths in canvas units, lower bound 1).

Conditions (inline `visibleWhen`): `families`, `arrows` ← direction from → to; `arrowSize/At/Share` ← arrows on;
`nodeOrder`, `sectorBy`, `groupGap`, `groupBands` ← endpoints circle or line; `startAngle` ← circle; `bandWeight` ← group bands on;
`focusGroup` ← highlight group or pair; `partnerGroup` ← pair; `heaviestShare` ← heaviest; highlight tone/material and their
weight/spacing/bead ← highlight on (and material); `edgeWeight` ← ink/stitch, `edgeSpacing` ← stitch/beads, `edgeBead`/`edgeBeadSize` ←
beads; `nodeScaleAmount` ← size by total flow. Numeric relevance (for example separation when hub depth makes ports coincide) is not
expressible and stays visible.

Seed: matters only for a seeded node shuffle on circle/line, partial retention, and partial arrow share on a directed dataset;
otherwise the drawing is seed-independent and `usesSeed` says so.

## Checks

`tests/composition-bundled-relations.test.ts` (27 tests): exact layout geometry (ring radius, proportional sectors, exact gaps,
ellipse and rotation, line baseline and up vector, graph keep/fit), node orders, strength 0 exactly straight, linearity in strength,
endpoints exact, convex-hull containment, family membership and disjoint waypoints, opposite/parallel identity, route locality under
removal/reordering/selection, measured gathering of families against the straight drawing, selection scope/retention monotonicity/weight
fraction, highlight sets, marker position and direction, bands, named work bounds, table binding errors, sample shape, transparent
drawing of every dataset × layout with JSON replay, stage caching under appearance vs structural edits, weight bands, direction encoding,
consumer substitution, seed semantics, limits, preparation. Mutations proven to fail tests: strength-0 special case removed; families
collapsed by lower group; ports depending on which families exist; straightening non-linear in strength; directed families merged.
A 2021-change hidden-control audit (random valid configurations, every hidden control changed) found no drawing change, and no control is
inert across five configurations.

## Review record

Rendered through a throwaway SVG surface under the native lease (`.work/`, removed). Looked at: defaults, three seeds, strength 0 / .5 / .9,
hub depth, lift and separation extremes, pair versus directed families, line and map layouts, all three datasets, each scope, beads and stitches,
highlights of each kind, a sparse and a 3600-edge extreme graph, and layered pairs in both orders with Contour Scores, Region Quilts and Motif
Ecologies. Defects found by looking and fixed: (1) first authored defaults (separation .45, hub .55, lift .35) tangled at the centre; defaults are now
.15 / .6 / .5 with strength .9; (2) within-group edges made deep loops — they now turn back at half hub depth; (3) colouring by source only left direction
unreadable and the stock arrow motif was unreadable at 7–10 units, so a source→target colour split was added and arrowheads default off; (4) the
straight-edge drawing was the right teaching foil and is one control away.

Timing (no-op recording surface, so it excludes raster cost; SVG-string surface for the 3600-edge case): default first prepare 10.9 ms, draw 3.1 ms;
appearance edits 0.1–0.9 ms prepare; material switch to stitches 15 ms draw; structural edits 2–5 ms prepare; a deliberately large setting (detail 16, beads at
spacing 3, rosette beads, 50 % highlighted, arrows) 5.9 ms first prepare, 26 ms draw (247k calls). Library-level 320 places / 3600 edges: layout 4.5 ms,
first bundling 27 ms (157k vertices), strength edit 20 ms, detail 16 48 ms.

## Open items

Not operated through the real Studio interface; real p5 canvas cost of ~250k drawing calls not measured; host binding of the user's own table is future
host work; the arrow motif is small and chiral (a filled head would need a new motif kind); one link per node pair (net flow) is a `Graph` property,
not a bundling one; `canPrepareInstrument` on `main` returned before reaching Data Scores (a stray duplicate `return`); this branch merges both into one line.

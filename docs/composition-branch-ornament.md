# Branch Ornament (brief 02)

Status: **implemented on branch `w1/branch-ornament`, unreleased. Reviewed from rendered
output only; not yet exercised through the real Studio interface, layered with other entries, or
reviewed for responsiveness in the app.** It builds on the frozen
[reference slice](composition-reference-slice.md) and
[structural operators](composition-structural-operators.md) boundary. Guide:
`packages/instruments/guides/branch-ornament.md`.

## Artist-facing brief

Grow a branching tree, then decorate it by what each part is: blossoms at tips, joints at forks,
a base ring, pennants along the stems, plus a separate outline ribbon that reads the same tree.
Sparse botanical fragments (prune the tree, keep blossoms on the cut ends) and abstract
circuit ornament (45° routing, rings and dots) are the same instrument with different settings.
Nothing about the marks, materials, outline or palette can regrow the tree.

## Producers and consumers

| Piece | Where | Contract |
|---|---|---|
| Growth with lineage | `adapters/attractor-growth.ts` (`growthModel`, `prepareGrowthModel`) | The existing replay, extracted so the drawing study and the tree read one cached computation. It now also records, per segment, the parent segment (`-1 - root` for a root tip) and fork slot. The Attractor Growth default drawings are unchanged (15 fingerprints over five variants and three seeds identical before/after). |
| `branchTree(options)` | `composition/branch-tree.ts` | Frozen, cached tree of nodes and edges. Options are the growth construction plus `routing`. |
| `attachmentSites(tree, options)` | same | Frozen, cached `Site`s per role with local frames. |
| `branchOutline(tree, options)`, `visibleEdges(tree, visibility)` | same | Outline ribbons and the visible edge subset; the same visibility feeds edges, outline and (optionally) marks. |
| `branchOrnamentComposition`, `drawBranchOrnament`, `prepareBranchOrnament` | `composition/branch-ornament.ts` | Typed JSON-compatible descriptor, its drawing and cooperative preparation. `drawBranchOrnament` accepts ordinary `Mark` / `PathMaterial` callbacks per consumer. |
| Definition and controls | `adapters/branch-ornament-instruments.ts` | Growth controls are the Attractor Growth study's own `Parameter`s (same keys, labels, domains, validation); only conditions and explicit integrality are added. |

## Frozen semantics chosen

- **Topology.** The native step leaves a `step`-long gap after each consumed attractor; the tree
  bridges it, so an edge is one connected polyline between two nodes. Nodes: `trunk` (base of a
  root tip), `fork` (two or more grown branches leave), `terminal` (a branch that grew no
  further). A consumed attractor whose sibling never grew is a bend inside an edge. Depth counts
  forks from the trunk (trunk edges 0; both children of a fork are one deeper). A root that never
  grew is omitted and counted in `barrenRoots`; zero ticks gives the valid empty tree; an
  unmatchable native step throws an explicit error.
- **Ids.** Edges `edge:<tick>.<k>`, end nodes `end:<tick>.<k>`, bases `root:<n>`, sites
  `<role>@<node id>` and `flank@<edge>#<i><+|->`. Raising `ticks` only appends (tested);
  routing never renames; depth window, offset, inheritance and falloff never rename a site;
  a flank station keeps its id across side modes. Seeds are `componentSeed(seed, id, purpose)`.
- **Frames.** Terminal and trunk: the branch heading. Fork: the mean of the outgoing branches'
  unit first steps when its length is at least `FORK_RESULTANT = 0.25`; otherwise (children a
  right angle apart, three at 120°, or any near-cancelling spread) the arriving heading. The
  axis is defined for every spread and never normalises a vanishing sum. The rule is
  discontinuous exactly at the threshold; both sides are valid frames. Flank: the edge tangent
  turned by `±angle`, the negative side mirrored (negative scale) so chiral marks stay symmetric.
- **Angle inheritance.** Rendered angle is a shortest-arc blend from canvas-up (−π/2) to the
  frame (1 = the frame exactly, 0 = upright). Offset is measured along the frame axis, not the
  rendered angle. Size falloff is `1 − falloff · depth / maxDepth` (never below 0.05); it is
  anchored to the whole tree so eligible-depth edits never rescale marks.
- **Visibility.** `visibleEdges` = depth window plus stable per-edge retention (hash of the edge
  id and seed, so raising retention only adds edges). With `visible` set, attachment reads
  roles from the visible edges: a node needs its arriving edge visible; no visible child is a
  pruned end and becomes a `terminal` framed by its heading; one is a bend (no site); two or more
  a `fork`, re-framed from the remaining branches. Off, marks ignore visibility.
- **Routing.** `grown`, `smooth` (two Chaikin rounds, ends and end directions kept), `straight`,
  `octilinear` (one 45° elbow, order chosen from the edge id). Endpoints, ids and topology are
  unchanged.
- **Limits.** Growth keeps its own budget (2048 tips, 16,000 segments, 1.8 M tip–attractor
  queries) and error text. Flank sites are capped at 30,000 with a message naming spacing and
  depth. Consumers charge the shared composition run per site and path.
- **Units.** Canvas units; option angles in degrees, published frames in radians.

## Controls and groups

Sections in order: **Attractors**, **Placement**, **Roots** (proportional *Spread*),
**Growth** (proportional *Reach*, *Branching*), **Branches** (*Stitches*, *Visibility*),
**Outline**, **Marks**, **Tips**, **Junctions**, **Base**, **Flanks** (each role: mark, *Eligible
depth*, offset, proportional *Scale*, *Shape*). Placement follows the first construction section.
Conditions (all inline `visibleWhen`): `exclusion` for area/two-lobe, `band` for ring,
`lobeGap`/`lobeBias` for two-lobe; stitch controls for stitch material; ink/stitch weight and
falloff unless material is none; every role control except its mark selector while the mark is
none; weight for ring/rosette/arrow, petals for rosette, opening for ring/rosette; flank
spacing/sides/angle while flanks exist. The control audit (74 controls, 4,257 probes) reports
zero violations and proposes no further conditions; `rootHeading`/`rootSpread` are inert with one
root, and the mark-wide controls matter only if a mark exists, which a conjunctive condition
cannot state, so they stay visible.

## Checks

`tests/composition-branch-ornament.test.ts` (18 tests): analytic single-branch fixture (trunk
ends exactly on its attractor), topology and coverage of every grown segment, no forks without
branching, id/seed/cache stability across routing, ticks and seeds, routing geometry (45° legs,
Chaikin endpoints), fork frames for cancelling children at unit and tree level, terminal/trunk
frames, site identity/window/offset/inheritance/falloff and failures, flank station arc length
and side/mirror/id rules, outline areas (rectangle `2wL`, blade `wL`, per-depth width), visibility
and retention monotonicity, roles on the visible tree (pruned ends, re-framed forks), descriptor
versus ordinary functions operation for operation, callback substitution, bounded work and errors,
preparation and cancellation. Mutations confirmed to fail: dropping the fork fallback, letting
edges continue through forks (six tests), non-alternating flanks, unwrapped angle blend, flank
stations from arc zero.

## Review record

Rendered with a throwaway SVG surface (defaults, three seeds, wreath, forest, two-lobe, circuit,
stitched vine, blades, constellation, pruned fragments, dense). Defects found and fixed:

- default was a small tree on a long bare trunk: footprint enlarged and root moved up;
- growth run to exhaustion piled every tip onto the last targets, a basket: default ticks stop the
  frontier while tips are still spread;
- polylines were faceted and jagged: `smooth` routing added and made the default;
- no way to a crisp circuit look: `octilinear` routing added;
- hidden branches left marks floating in mid-air, useless for fragments: roles are re-read from
  the visible tree (*Marks follow branches*, on by default; off keeps marks where the full tree puts them);
- one shared eligible-depth window forced the same depths for blossoms, joints and pennants:
  windows are per role.

Open: terminal marks cluster where several tips converge on one attractor (growth behaviour;
size/variation/retention soften it); outline ribbons are separate strokes, so a child's flat base
shows as a small notch at a fork when taper is 1; two-lobe growth crosses the gap as a long
parallel bundle. Not exercised: the real Studio controls, layered compositions, both layer orders.

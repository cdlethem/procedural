# Roads and Parcels (brief 43)

Status: implemented on branch `w3/roads-parcels`, not yet root-reviewed through the real interface. Built on
the [stateful snapshots](composition-snapshots.md) (F7), [graph roles](composition-graph-roles.md) (`planarFaces`)
and [planar domains](composition-domains.md) foundations and the frozen
[reference slice](composition-reference-slice.md) conventions. It is a 2D model of how a street framework is
organised, not a city simulation and not physically or economically accurate.

## Artist-facing brief

A connected street framework with coherent enclosed blocks and local variation. Streets are grown one at a
time along a chosen guide field (grid, radial and ring, spiral, organic noise); every enclosed face of the
resulting planar graph is a block; each block is cut into lots along its nearest road; lots are typed by a
stated rule and each type gets its own filler; a reserved zone, a hub plaza, unbuilt blocks, interior courts and
dead-end regions are defined as open land. Roads are drawn by the existing `pathMaterial` in three width classes.
The instrument is **one producer chain with several consumers**: lots (flat colour, `regionFill` hatch, dots or
contours), roads (`strokeWith`), junction marks (`atEach` + `motif`) and, in code, any other consumer of the
graph, blocks or parcels. Palette, material and fill edits repaint the same cached objects.

## Pipeline and values (`src/composition/`)

| Stage | File | Value | Cached by |
|---|---|---|---|
| Guide field | `road-field.ts` | `RoadField`: orientation (modulo 90 degrees) at a point and the direction closest to a heading | (pure) |
| Growth | `road-growth.ts` | `roadSimulation` (a F7 `Simulation`): state = append-only nodes, edges, streets, stalled discs, an edge grid | shared `SimulationCache` (construction key, no appearance) |
| Network | `road-network.ts` | `RoadNetwork`: planar `Graph`, `streets` (one `Path` each), `deadEnds`, `openEnds`, `progress` | identity of the `Snapshots` and the placement |
| Blocks | `road-parcels.ts` | `RoadBlocks`: each `planarFaces` face as a `PlanarRegion`, its `land` (a `PlanarDomain`), road classes and ages per edge | identity of the network and (hierarchy, widths, setback) |
| Lots | `road-parcels.ts` | `RoadParcels`: every `Parcel` (lot, court or reserved) with a `PlanarRegion`, frontage, front road, angle, age, type, frame | identity of the blocks and the lot options |
| Composition | `roads-parcels.ts`, `roads-parcels-params.ts` | `RoadsParcelsComposition`, `roadsParcelsProducts`, `drawRoadsParcels`, `prepareRoadsParcels` | |

### Model (growth), one step at a time

One step tries to add one street. (1) Origin: the first `anchors` steps use points on a ring; later steps draw 16
probes from the street's own stream and take the one with most room (clearance to the nearest road or site edge
divided by the local block scale, which shrinks toward the focus by `focusScale` over `focusReach`); if no probe has
room, an exhaustive lattice is scanned in 16 bands, one band per step, and when all are empty growth is **done**
(`progress.done`, `doneAt`; every later step returns the state unchanged, so extra steps change nothing). (2)
Direction: the field's along or across direction turned by the street's wobble, whichever is more perpendicular to
the nearest road. (3) Trace both ways with a midpoint (RK2) integrator through the field, stopping at the first road
(a junction: the road is split there, or the street lands on a node within `snap`), at the site edge, or failing
(would meet a road shallower than `minAngle`, would meet itself, or has no budget). `junction` lets the trace pass
through 0, 1 or 3 ordinary streets first. (4) Commit: simplify (tolerance under `snap / 3`), create nodes, split
the roads met, append edges. A failed street is dropped (`deadEnds: "drop"`) or kept as a dead-end stub when its
other end connected (`"stub"`); a stalled disc around its origin keeps later probes out of the void.

Update order is sequential over streets: each street reads the network including every earlier street. Random
draws come only from `ctx.stream("street:<serial>", purpose)`, never draw order. A reserved zone, hub ring and the
boundary road are streets of step 0 (rings joined to their surroundings by two field-aligned links, so no block
contains a bridge). Split edges keep their id (`b` moves) and the second half is a new edge; nothing is removed, so
growing `steps` only appends.

### Failure disposition

| Situation | Disposition |
|---|---|
| A trace ends on a road | Junction node, road split; topological agreement is checked by tests with brute force |
| A trace would meet at under `minAngle`, meet itself or run past its budget | Street fails: dropped, or kept as a stub if it connected elsewhere |
| A stub or an open-ended street (no boundary road) inside a block | Dangling edge: bounds no face; lots keep a strip of half its width plus the setback clear of it |
| A face thinner than its roads, or a fragment under 0.01 square units | No land / no parcel (numerical residue is not land) |
| A block deeper than about 1.6 lots | Lots along the roads; the interior is a `court` (`landlocked`) |
| The reserved zone, the hub | A block of its own: one `reserved` parcel, reason `zone` / `hub` |
| Blocks chosen by the unbuilt rule | One `reserved` parcel per land region, reason `unbuilt` |
| Nothing fits at all | Only the boundary road exists; the site is one block; growth reports `done` |

### Blocks, land and lots

`planarFaces(view)` supplies simple counter-clockwise polygons (its own crossing, pinch and island checks; the
growth never produces a rejected face and the tests assert it). Land = block minus strips of half-width
`class width / 2 + setback` along every face edge (round caps at reflex corners and where adjacent widths differ) and
along every dangling edge inside it, by the exact `domainDifference`, then opened by 0.02 units with round joins
(a subset of the exact land; it removes hairline needles that nearly collinear strips leave). Land can have several
regions or holes. A piece is cut across its nearest road when wider than 1.5 lot widths (cut position 1/2 spread
by `variety`, keeping both halves at least 0.55 lot widths) and parallel to it when deeper than 1.6 lot depths.
Lot frame = the direction of the nearest road edge to an interior point of the piece; a leaf is a `lot` with at
least 0.3 lot widths of frontage, a `court` otherwise, a `sliver` under a tenth of a lot. Types: road class of the
frontage, area rank, distance rank from the focus, age of the front street, or a stable draw (three equal bands).

### Ids, seeds, units

Canvas units and degrees. Nodes `n:<serial>`, edges `e:<serial>` (serial from a counter in the state), streets
`street:<rank>` (ring streets `frame`, `zone`, `hub`, `link:<k>`), blocks `block:` plus 16 hex digits of a hash of
the face's node cycle (changes exactly when the boundary changes), parcels `<block id>/<land region>[:<cut path>]`.
Seeds are `componentSeed` of the instrument seed and an id and purpose; lot cuts and types use the parcel id.

## Bounds

Steps at most 1500 (hard) and 240 (slider); work per step at most 150,000 counted units (grid cells and segment
tests) so a run is bounded by `steps x 150,000` under `maxWork` 250,000,000; the edge grid has at most 400,000 cells
(error names **Block size**); at most 4,000 blocks and 12,000 lots (error names Block size, Steps, Lot width or Lot
depth); state values and checkpoints are bounded by the runner (a checkpoint every 60 steps; every step's counts are
retained). Nothing is thinned; every error names a control.

## Controls (groups; `proportional` marked)

Streets (pattern, block size, steps, wobble, anchors, anchor ring and angle, boundary road) · Placement (centre,
**Size** width/height proportional, rotation) · Guide field (grid angle, spiral turn, warp, field scale, hub ring) ·
Junctions (policy, snap, shallowest meeting, dead ends) · Focus (X, Y, blocks at focus, reach) · Reserved space
(zone shape, X, Y, **Zone size** width/height proportional, angle, unbuilt share and rule) · Hierarchy (avenues,
collectors) · Lots (width, depth, variety, setback) · Lot types (rule, fills A, B, C) · Filler (spacing, weight, hatch
angle, inset, underpaint, outlines) · Roads (**Widths** avenue/collector/street proportional, material, stitch spacing,
road colour, junction marks and size).

Inline `visibleWhen`: grid angle (pattern grid), spiral turn (spiral), warp (grid, radial, spiral), hub ring (radial,
spiral), zone X/Y/size/angle (zone not none), stitch spacing (stitches or beads), mark size (marks on), outline
weight (outlines on). A hidden control never changes the drawing: the construction parameters substitute a constant
for every hidden or inert control (the growth key ignores a hidden grid angle, hub ring, warp on organic, zone
geometry with no zone, anchor position with no anchors), and a seeded property test changes hidden controls and
compares draw fingerprints. Controls whose relevance is a numeric threshold or a disjunction stay visible and are
not guessed: anchor ring and angle (matter only when anchors > 0), unbuilt rule (only when the share > 0), hatch
angle (only when some type is hatched), fill spacing, weight, inset and underpaint (only for non-solid types).

## Input contract

Persisted instruments store the technique id, scalar controls and the palette. The reserved zone is one of two
bundled shapes chosen by a validated select; a user's own geometry, mask or street set is **host binding work not
done here**: the direct API takes typed values (`growRoads` params, `roadBlocks`/`roadParcels` options) and returns
frozen values, but the saved instrument cannot name an asset.

## Verification

`tests/composition-roads-parcels.test.ts` (23 tests): planarity by an independent brute-force test over every
edge pair (no crossing, no vertex on another edge, no overlapping edges at a node) for seven configurations and
five seeds; Euler's formula (`faces = E - V + 1`) and that the faces tile the site's area exactly; junction policy
counted independently; the shared `checkSimulation` (replay, prefix, checkpoint spacings); append-only ids and
positions under more steps; termination (`done`, `doneAt`, extra steps identical, nothing-fits site); the widest
open disc; palette and every appearance control repaint the same snapshots, network, blocks and parcels **by
identity**, while lots, widths and placement recompute exactly the stages they should; initial-condition edits
change the key and hidden ones do not; cancellation leaves nothing cached and a retry equals an uninterrupted run
(also through `prepareInstrument`); lots keep half a road width plus the setback from every road of their block and
from dangling roads; parcels tile the land exactly and stay in their block; lot orientation (multiples of 90 degrees
on a straight grid, nearest-road front edge by brute force); zone, hub and unbuilt rules; type bands by distance,
size and class; structure edits update every binding coherently and unchanged blocks keep ids; error messages name
controls; transparent drawing; hidden-control property test; grouped and conditional definition; the authored default
shows three fills, three road classes, a zone and open land; frozen values.

Mutations proven to fail (each by at least one test; count of failing tests): no split of the road a street meets (10); lots keeping
half the road width but no setback (2); a hidden anchor angle reaching the growth key (1); the network cache ignoring the
placement (1); lot frames taken from the first face edge instead of the nearest road (1); growth that never sets `done` (2);
dangling roads not removed from the land (1).

## Review record

Rendered through the throwaway SVG surface under the native render lease: defaults on seeds 42, 7 and 1234567; nine deliberately
different settings (planned grid with crossroads and four anchors; radial city with hub and tight focus; spiral with long
crossings; organic old quarter with an open edge and stitched roads; wobble with stubs; a rectangular park with unbuilt largest
blocks; dense fine mesh; sparse large blocks; bead roads by age with ring marks); steps 0, 4, 12, 30, 80 and 300 with roads coloured by
age; and two layered pairs in both orders with the unmodified Region Quilts and Contour Scores. Defects found and fixed by looking and by tests:

- Lots met a road at a corner where two roads of different widths join (a flat strip end left land inside the wider road's
  half-width): a round cap now goes on every corner where widths differ or the boundary turns reflex.
- A zero-width needle of land, a few ulps wide, at nearly collinear corners became a lot with a spike: land is opened by 0.02
  units (an inscribed polygon), and fragments under 0.01 square units are dropped as numerical residue.
- Dead-end stubs and streets leaving an open edge sat inside a block and lots ran through them: dangling edges (found by removing
  degree-1 nodes repeatedly, not by a flag, because a later street can attach to a stub) are stripped from the land.
- The first default drew a hatch/dots/contour fill by recomputing each lot's geometry on every draw (the shared 64-entry region
  cache thrashes with hundreds of lots): lot geometry is published once as a prepared scene, giving 200 ms per redraw down to 2 ms.
- A rectangular reserved zone had links at corners; links now leave from opposite edge midpoints along the guide field.
- Solid default fills hid the roads' hierarchy and the default palette made the tiny lots muddy: warmer accents, underpaint 0.3, weight 1.
- Contour fills in small lots were a few squiggles: one hill and more levels, so they read as concentric rings.

Later review (responsiveness): the worst slider corner with every treatment on took 4.1 s. Cost drivers found and their slider intervals
narrowed (hard limits unchanged, so exact entry still reaches them): Block size slider 70 to 240 (was 40), Focus block scale slider .6 to 1
(was .25), Lot width slider from 14 and Lot depth from 18 (were 8 and 12), Steps slider 0 to 240 (was 600), and contour fills use a 12 by 12
sample and six levels (were 24 by 24 and eight; hatch and dots were cheap). Steps default 60: at the default site growth finishes at step 42
to 51 on eight seeds, so the default is the finished network and only about the first 50 slider values act; a smaller block or a larger site
finishes later (about 120 steps at block size 70 on 640 by 640, up to about 210 with the focus shrinking blocks), which the slider maximum
covers. Two further defects found while measuring: the trace ended on the first road it came within the snap distance of even when the
junction policy allowed passing it, so crossroads and long crossings did nothing whenever the trace step (block size / 16) was shorter than
the snap distance (block size 60 or less at the default snap): now a passable route street is not "near"; and the exact Boolean over road
strips failed to converge (`NOT_CONVERGED`) on a dense organic mesh with snap 1: strips are snapped to a 1/1024 lattice after widening by
0.001, more than the snapping error, so lots still keep the full half-width. A 150-configuration random fuzz over every pattern, junction
policy, dead-end policy, zone shape and size now raises only the deliberate error naming Hub radius when the hub ring overlaps the zone.

Timing (Node 22, null drawing surface, best of three seeds, CPU milliseconds with wall time in brackets, on a shared machine with a load
average of about 17, so an idle machine should be no slower):

| Case | First draw | Palette only | Road, mark, outline styling | Lot width edit | Structural edit (block size + 2) |
|---|---|---|---|---|---|
| Default (60 steps, 29 streets, 345 lots) | 464 (567) | 7 (8) | 5 (7) | 188 (400) | 354 (640) |
| Default with hatch, contours, dots, ring marks and bead roads on | 243 (229) | 3 (3) | 2 (2) | 51 (50) | 204 (204) |
| Slider corner: block 70, 640 x 640, 240 steps, focus .6 over 600, lots 14 x 18, every treatment on | 760 (654) | 10 (7) | 8 (6) | 293 (268) | 660 (596) |
| Same with long crossings | 691 (626) | 6 (6) | 6 (5) | 256 (237) | 678 (612) |
| Same, organic pattern, wobble 40, snap 1 | 876 (798) | 9 (8) | 7 (7) | 400 (375) | 823 (777) |
| Hard corner: block 14, focus 1, 1500 steps, lots 10 x 14, every treatment on (1,379 streets, 1,382 blocks) | 2,007 (1,870) | 25 (17) | 16 (15) | 406 (379) | 1,737 (1,586) |

A structural edit reruns growth from the start (its key changed), then blocks, lots and fill geometry; steps up or down reuse checkpoints
(every 60 steps). `prepareInstrument` runs every stage in time slices and can be cancelled between them.

## Open questions

- Growth is sequential and single-threaded; the slowest measured case is in the timing table of the review record.
- Contour fills in lots under about 12 units read as one or two rings.
- The zone is a bundled ellipse or rectangle; binding a user's mask needs a host input.
- Real-interface review, and layering in the private Studio, are not done.

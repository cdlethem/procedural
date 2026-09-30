# Hyperbolic Gardens

Cells that keep their shape and shrink toward a circle. The study draws a regular tiling of the
hyperbolic plane in the Poincaré disk: every cell is the same regular polygon, the same number of
them meet at every corner, and each is the mirror image of its neighbour across the shared edge, but
the disk's scale falls to nothing at the rim, so the cells crowd and shrink toward the boundary
circle without ever reaching it. Edges are the true straight lines of that geometry: circular arcs
that meet the boundary square on, or diameters. The starting study is the tiling {5,4} (pentagons,
four at a corner) grown outward from a pentagon, with alternate generations painted and left bare,
a small chiral sprig in every mirror-image triangle of every cell, and a few cells omitted by chance
so the seed reshuffles the gaps. It is not the Euclidean repeat of Wallpaper Motifs, and it is not a
coordinate fold: nothing is bent afterwards, the tiling is exact, and a mark placed in it is turned,
reflected and scaled as the geometry itself would move it.

Everything is built from the tiling. Changing colours, weights, fills, edge material or motif style
never moves a cell, an edge or a frame. Changing *Cell retention* only decides which cells remain.
The anchor rebuilds the motif frames; rings rebuild their chains. Changing the tiling, centre,
cutoffs or placement builds a new tiling, but a cell keeps its name: raising generations or the
disk radius, lowering the smallest cell, rotating or moving the disk never renames what was
already there.

## Choose the tiling

| Controls | What changes on the canvas |
|---|---|
| **Polygon sides**, **Cells at a vertex** | The tiling {p,q}. It is hyperbolic only when (p−2)(q−2) > 4; {3,6}, {4,4} and {6,3} are the flat tilings and {3,3}, {3,4}, {3,5}, {4,3}, {5,3} the spherical ones, and all are refused with both controls named. {7,3} (heptagons), {5,4}, {4,5} and {3,7} (triangles, seven at a corner) are the classic small cases. Cells with more sides or more cells per corner make everything shrink faster. |
| **Centre on** | Where the middle of the disk sits: a **cell centre** (p-fold symmetry), a **vertex** (q-fold) or an **edge midpoint** (two-fold). It is the same tiling seen from three places. |
| **Generations** | Rings of cells grown from the centre; each is every cell sharing an edge with the last. It is a ceiling: growth also stops at the disk radius and the smallest cell. |
| **Disk radius** | A cell is kept only when all its corners lie inside this fraction of the disk. Lower it for a plain rim; tilings with many-sided cells have big cells and need a value near 1 before any cell past the first fits. |
| **Smallest cell** | A cell drawn smaller than this many canvas units is not built, and nothing beyond it is: the declared stop that keeps the work finite near the boundary. Lower it to reach closer in, at a cost. |
| **Cell retention** | Share of cells kept. An omitted cell takes its edges, rings and motifs with it and leaves bare paper; edges shared with a kept cell stay. The same cells are omitted whatever the drawing style. |
| **Center X/Y**, **Disk radius (canvas)**, **Rotation** | Where the disk sits, the canvas radius of the boundary circle (all lengths scale with it) and a turn about its centre, in degrees, clockwise. |

The kept region is the connected component of the central cells inside all of these tests. A cell
that passes them but is reachable only through cells that fail is not drawn.

## Fill the cells

| Controls | What changes on the canvas |
|---|---|
| **Fill** | **Flat** paint, **hatched** lines at one direction across the canvas, or a **checker** that alternates by generation: flat and bare, hatched and bare, or flat and hatched. With an even number of cells at a corner the alternation is an exact two-colouring of the tiling; with an odd number it is a ring pattern, because the tiling has no two-colouring. |
| **Gap between fills** | Each filled cell is drawn back toward its centre by this fraction of the way to its corners. It is a true hyperbolic shrink, so the gap narrows toward the rim like the cells. |
| **Fill opacity**, **Hatch spacing**, **Hatch angle**, **Hatch weight** | Paint strength, and the spacing (canvas units, not tapered), direction and thickness of hatch lines. Hatch lines are anchored to the canvas, so neighbouring cells continue each other's lines. |

## Edges and rings

| Controls | What changes on the canvas |
|---|---|
| **Edge material**, **Edge weight**, **Station spacing**, **Station phase**, **Bead mark**, **Bead diameter**, **Bead line weight** | Every shared edge is drawn once as a geodesic arc: ink, stitches or beads. Spacing and bead size shrink with *Weight taper*. |
| **Edge color** | Ink, or a palette entry by the generation of the cells the edge borders. |
| **Rings around**, **Rings**, **Ring radius**, **Roundness**, **Ring weight** | Concentric rings around every cell centre, vertex or edge midpoint, drawn per mirror-image triangle and joined across the mirror lines into closed curves. *Ring radius* is a share of the largest circle that fits: 1 touches the edge midpoints (cells) or the neighbouring circles (vertices). *Roundness* 0 gives a straight-sided geodesic polygon (2p sides around a cell), 1 a true hyperbolic circle. Where a ring is cut by the edge of the region it stays open. |

## The motif

| Controls | What changes on the canvas |
|---|---|
| **Motif** | One mark in every fundamental triangle of every cell, 2p per cell: an **arrow**, a **sprig** (a stem with twigs on one side, each forking once), a dot, rings or a rosette. Arrows and sprigs are chiral, so every reflection reads. |
| **Anchor: centre to edge**, **Anchor: vertex to edge middle** | Where in the triangle the mark sits. At 0 or 1 the anchor is on a mirror line and the copies that land on one point are merged: a mark on the cell centre is placed once, not 2p times; on a mirror it is placed once per pair, always the unreflected one. |
| **Motif size**, **Motif line weight**, **Motif turn** | The mark's diameter as a share of one cell edge at that place; stroke thickness at the disk centre; and a turn inside its frame. Size and strokes shrink with the disk's scale, the true hyperbolic rule. |
| **Rosette petals**, **Sprig twigs**, **Motif opening**, **Size variation**, **Smallest motif** | Mark details; stable random shrinkage (a new seed reshuffles it); and the pixel-scale stop for marks: those drawn smaller than this many canvas units are left out. |
| **Motif color** | Ink, the same colour as the cells beneath, or the next palette entry along so it stands out from a fill of its own colour. |

## Colour, boundary and taper

| Controls | What changes on the canvas |
|---|---|
| **Color by** | **Generation** (rings of colour outward), **mirror distance** (how many mirror lines lie between an element and the base triangle: a wave of reflections), **parity** (cells by ring parity, motifs by reflection), **sector** (the symmetric slices about the centre), **one accent**, or **ink**. Palette entry 0 is ink for edges and the boundary; fills, rings and motifs use the rest. |
| **Boundary circle**, **Boundary weight** | The circle the tiling compresses toward. |
| **Weight taper** | How much line weights (edges, rings, hatching) and station spacing follow the disk's scale: 0 keeps them constant, 1 makes them proportional so lines thin out toward the rim like the cells. |

## Things to try

| Setting | Result |
|---|---|
| {7,3}, Fill Flat, Color by Mirror distance, anchor 0.8 / 0.15 | Four-colour heptagons with sprigs clustered at the corners; every corner has three cells. |
| {4,5}, Centre on Vertex, Fill None, Rings around Cell centres, Roundness 0, Rings 4 | Nested octagons (2p sides around a four-sided cell) inside five cells at a corner. |
| {8,3}, Rings around Vertices, Edge material Beads, Fill None | Circles around each corner meeting neighbours, on a chain of beads along every edge. |
| {3,7}, Centre on Edge midpoint, Fill Checker: flat and hatched, Motif Arrow | Triangles seven at a corner with reflections legible in every arrow. |
| Cell retention 0.3, Generations 7 | A few islands of the tiling: the omitted cells are chance, the rest is exact. |
| Anchor 0 / 0.5 with a dot | One dot at every cell centre; move the anchor to 1 / 1 for one at every edge midpoint. |

## As functions

The producers are ordinary functions; the instrument is one composition of them. Everything is
canvas units and degrees, with the unit disk of canvas radius `radius` centred at `(centerX, centerY)`.

```js
import { hyperbolicTiling, hyperbolicEdgePaths, hyperbolicCellPaths, hyperbolicFrames, hyperbolicRings,
  atEach, strokeWith, motif, pathMaterial, createCompositionRun } from "@procedurals/instruments";

const tiling = hyperbolicTiling({ seed: 7, p: 7, q: 3, center: "polygon", generations: 8, diskRadius: 0.985,
  minSize: 1.6, centerX: 320, centerY: 320, radius: 296, rotation: 0 });
// tiling.tiles: cells as sites (position, angle, scale = 1 - |z|^2) with neighbours, outline and transform;
// tiling.edges: each shared arc once; tiling.vertices; tiling.layers: cells per generation.

const ink = pathMaterial({ kind: "ink", weight: 1.4, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x1f2733]);
strokeWith(p, hyperbolicEdgePaths(tiling), ink, createCompositionRun());

// One frame per mirror-image triangle; negative scale means a reflection, and atEach applies it.
const frames = hyperbolicFrames(tiling, { seed: 7, radial: 0.6, along: 0.35, minScale: 0.02 });
atEach(p, frames, motif({ kind: "arrow", size: 0.4 * tiling.edgeSize, petals: 0, opening: 0, weight: 1.2,
  rotation: 0, variation: 0, retention: 1 }, [0x1f2733, 0xc4573b]), createCompositionRun());
```

`hyperbolicCellPaths(tiling, inset)` publishes cell outlines as closed paths and `hyperbolicRings`
publishes ring chains, both for `strokeWith` with any material or fill. `retainCells` restricts a
tiling to chosen cells with every id kept. `drawHyperbolicGardens` takes `{ cell, edge, ring, mark }`
callbacks to replace any built-in consumer while the tiling and its frames stay the same cached
objects. The instrument only names bundled construction ({p,q} and the choices above); binding a
caller's own motif or path to a Studio layer is future host work.

## Limits

The disk radius is limited to 0.9999 and the cell size to 0.05 canvas units. A tiling of more than
20,000 cells, motif frames beyond 60,000 or ring arcs beyond 80,000 is refused with the controls to
change named (Smallest cell, Disk radius, Generations, Polygon sides, Smallest motif, Rings); nothing
is silently truncated. Cells, vertices, edges, frames and ring points are identified by exact
mirror-address, not by comparing positions with a tolerance, which is what merges coincident copies
and keeps names stable. Near the rim the numbers are large (a cell ten hyperbolic units from the
centre involves values around 10^4); the disk radius limit keeps every sign test far above the
rounding noise. The study is drawn in the Poincaré disk only. The Klein view is not conformal, so a mark's
frame there could only be approximate, and the half-plane has no natural finite window; neither is offered.

# Surface Weave

Two families of threads run across a curved surface and are woven over and under where they cross. The
starting study is an amphora vase seen in perspective: flat ribbons spiral up it in both directions, turning
a little more steeply toward the neck, crowded on the belly where the vase is widest and spread out at the neck,
each ribbon going over, under, over along its length. Ribbons narrow toward the silhouette because they lie in
the surface, the far wall is hidden by the near one, and through the open rim you see the threads on the inside.
The picture stays transparent around the vase, so it can sit above or below other layers.

The threads are traced **on the mesh**, triangle to triangle, not in a flat parameter space, so a vase
seam, a torus wrap or a sphere pole needs no special treatment, and *spacing is a distance on the surface*:
the same number of threads per length wherever the surface curves. The construction has separate stages,
and an edit only redoes the stages it touches:

| You change | What is recomputed |
|---|---|
| Surface, Flow, Threads (spacing, density, edge) or the seed | Everything: the threads are re-solved and their ids are new |
| Over and under, Invert, Exceptions | Who is over at each crossing; the threads and crossings stay |
| Camera (View, Placement) | Projection, hidden-line removal and the cut pieces; never the threads, crossings or over/under |
| Thread width, clearance, cross-section, hidden threads | The cut pieces only |
| Colours, shading, model drawing, overlay | Nothing: the same cut pieces are repainted |

## Choose the surface

| Controls | What changes on the canvas |
|---|---|
| **Surface** | **Vase** (a revolved vessel with a closed base and open rim), **Terrain** (a seeded height field), **Torus**, **Sphere cap** (an icosphere cap; 180 degrees is the whole sphere, which has no edge) or **Parametric sheet**. |
| **Terrain shape**, **Vase profile**, **Sheet shape** | Hills, ridges, crater or dunes; amphora, goblet, bottle or urn; a twisted ribbon (a helicoid through three quarter turns), a scroll rolled into a spiral (both overhang themselves and hide their own threads), a saddle or seeded waves. |
| **Detail** | Mesh resolution. Threads follow the mesh facets, so more detail rounds their curves and costs more (the sphere stops at 6 subdivisions). |
| **Relief** | Vertical scale of a terrain or sheet. |
| **Tube radius**, **Cap angle** | Torus thickness; the half-angle of the sphere cap. |

## Steer the threads

| Controls | What changes on the canvas |
|---|---|
| **Direction from** | The first family follows the isolines of a scalar on the surface: **Height**, **Distance from the axis**, **Distance from the centre**, **Plane bands** or **Seeded waves**; or **Guide direction** combs it along a fixed world direction. The second family is the first turned by the weave angle. |
| **Band direction**, **Wave frequency**, **Guide yaw**, **Guide pitch** | Plane bands: where the field increases; waves: cycles across the model; guide: the world direction. |
| **Thread angle** | Turns every thread away from its isoline (0) toward the steepest direction (90). |
| **Weave angle** | The angle between the two families on the surface. 90 is a square weave; small angles give a long diagonal lattice and shallow crossings. |
| **Swirl**, **Swirl field** | Turns the direction by up to Swirl degrees each way as the swirl field goes from its lowest to its highest value: the orientation changes across the surface. |
| **Thread spacing** | Distance between neighbouring threads of a family, as a share of the surface's linear size. |
| **Second family spacing** | The second family's spacing as a multiple of the first (a fine warp under a coarse weft). |
| **Density field**, **Density ratio**, **Reverse density** | A scalar that crowds the threads where it is high: spacing runs from spacing divided by the square root of the ratio to spacing times that root. |
| **Edge**, **Edge margin** | Threads run to the boundary, stop a margin short of it, or stop at a ragged random margin (a fringe). A closed surface has no edge. |

Where the direction field vanishes (a pole, a peak or pit of the field, the flat base under a height field) there
is no direction, so threads stop before it and that small region is left bare. A ring of threads that returns to its
start is closed; a strand ends where a neighbour comes within half the spacing, so where threads diverge new ones
start between the old and where they converge some end. Neighbouring threads end up 0.6 to about 1.25 spacings
apart, exactly one spacing where the field is parallel.

## Decide who is over

| Controls | What changes on the canvas |
|---|---|
| **Over and under** | **Alternate**: each thread goes over, under, over along its length wherever that can be satisfied. **Seeded**: a coin per crossing. **Family B over**: the second family lies over the first everywhere. |
| **Invert** | Swaps over and under at every crossing (the mirror weave). |
| **Exceptions** | Crossing numbers to reverse, such as `3, 7, 12-14`. Turn on **Numbers** to read them (crossings are numbered along the first thread, over the whole surface, including the far side). |
| **Clearance**, **Shallowest woven crossing** | Extra gap around each crossing; crossings seen at less than this angle in the picture are not woven (the threads overlap). |

A square weave on a plane alternates exactly. On a curved surface it usually cannot: a thread that ends in the middle
of the lattice, or an odd number of threads around a vase, forces some neighbours to be both over. The order is solved
with both a chain and a breadth-first method and the one with fewer contradictions is kept; **Breaks** rings what is left.
Expect the defects at the limbs, at thread ends and along one seam.

## Draw the threads

| Controls | What changes on the canvas |
|---|---|
| **Thread style** | **Cased** (an outlined colour), **Solid**, or **Hairline** (one thin line with small gaps: the edge-only drawing). |
| **Cross-section** | **Flat ribbon**: lies in the surface, narrows as it turns from the view and vanishes edge-on. **Round**: one width in the picture (keep it under about 0.55 of the spacing, or crossings consume the threads). |
| **Thread width** | Width as a share of the local spacing, so threads thin where the weave is dense; in perspective, nearer threads are wider. |
| **Casing**, **Outline weight** | Outline thickness of cased threads (for a ribbon, the stroke of its outline) and of the model's edges. |
| **Shading**, **Shade amount** | Threads fade with distance (depth) or as the surface turns from the eye (facing). |
| **Hidden threads** | Threads behind the surface are removed, or drawn as faint hairlines. |
| **Model drawn as** | **Outline**: silhouette and boundary edges only. **Veil**: a translucent pale surface behind the threads, painted far to near, with the same edges. **Nothing**. |
| **Colouring**, **Colour A/B**, **Ink colour**, **Veil colour**, **Veil opacity** | By family or by strand; palette slots. |
| **Overlay** | **Numbers** for Exceptions; **Breaks** rings where alternation fails. |

## The camera

| Controls | What changes on the canvas |
|---|---|
| **Projection**, **Distance** | Perspective (nearer threads larger) or orthographic; the eye distance in bounding diagonals. |
| **Yaw**, **Pitch**, **Roll** | Orbit, elevation and turn of the picture. |
| **Center X/Y**, **Size** | Where the model's bounds sit and the canvas length of its diagonal. |

## Things to try

| Setting | Result |
|---|---|
| Vase, Direction from Height, Thread angle 0, Weave angle 90, Swirl 0 | Rings crossed by meridians: the classic square weave. |
| Torus, Direction from Seeded waves, Weave angle 60 | Threads that wander over the tube in a diamond lattice. |
| Parametric sheet Scroll, Cross-section Flat ribbon, Thread width 0.9, Hidden threads Faint | A basket rolled into a spiral; the far layers show through as hairlines. |
| Sphere cap 100, Direction from Guide direction, Edge Fringe | Combed threads ending in a ragged edge. |
| Thread style Hairline, Model drawn as Veil | A sparse edge-only drawing over a pale surface. |
| Density field Height, Density ratio 4 | Threads crowd toward the top of the surface. |

## As functions

```js
import { surfaceWeaveComposition, surfaceWeaveProducts, surfaceWeaveView, drawSurfaceWeave, createInstrument,
  terrainMesh, createCompositionRun } from "@procedurals/instruments";

const input = createInstrument("surface-weave");
const recipe = surfaceWeaveComposition({ ...input, params: { ...input.params, surface: "torus", cross: 60 } });
const products = surfaceWeaveProducts(recipe);         // strands (3D polylines with ids), crossings, over/under order: camera free
const view = surfaceWeaveView(recipe, products);       // projection + hidden lines, cut pieces, model edges: for the recipe's camera
drawSurfaceWeave(p, recipe, { strand: myMaterial });   // or draw the same values with your own thread material

// Any resolved Mesh (a manifold with consistent orientation) can be woven directly:
const mesh = terrainMesh({ width: 4, depth: 4, columns: 40, rows: 40, height: (x, z) => Math.sin(x) * Math.cos(z) });
drawSurfaceWeave(p, recipe, {}, createCompositionRun({ maxWork: 800_000 }), mesh);
```

The lower-level pieces are ordinary functions too: `traceGraph`, `walkMesh` and `stepRK2` march across triangles,
`scalarField`, `flowVectors` and `spacingField` build the fields, `traceStrands` places the threads, `surfaceCrossings` finds where they
cross, and `orderCrossings` (from Crossing Lace) decides over and under. The instrument names only bundled surfaces;
binding a user's own model to a Studio layer is future host work. Drawing is 2D: no WEBGL, and nothing here reconstructs
a scan or promises a fabricable object.

## Limits

Threads are limited to 300,000 vertices and 30,000 crossings per construction, checked from the spacing fields before any
thread is traced; over the limit the error names Thread spacing, Second family spacing and Density ratio. Nothing is
truncated. Visibility is exact (no depth buffer), with its own work bound of 20 million units. A very fine sphere with a
veil is the slowest case (tens of thousands of triangles are painted far to near).

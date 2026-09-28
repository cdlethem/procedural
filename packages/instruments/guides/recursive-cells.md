# Recursive Cell Worlds

Nested compartments grown by bounded recursive subdivision. The root rectangle is split
using the same seeded binary-cut policy as region quilts; each node can split again until
depth, minimum size, or selective stopping stops it. Terminal leaves are filled by the
same three fillers — hatch, motifs, contours — with the same three levels of nesting.

## Grow the tree

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Width**, **Height** | Footprint of the cell world. |
| **Max depth** | Levels of recursive subdivision (1–12). |
| **Min leaf size** | Nodes with a shorter side stop subdividing. Smaller values allow deeper trees. |
| **Early stopping** | Stable fraction of nodes that stop growing. A stopped node becomes a terminal leaf regardless of its size. |
| **Child retention** | Stable probability each child branch is kept. Omitted children leave their area bare (negative space) without affecting sibling seeds. |
| **Cut axis** | LONGEST splits along the longer side; RANDOM picks randomly. |
| **Subdivision bias** | Negative gives balanced leaves; positive contrasts large and small areas. |

These are construction edits. A node's ID is a path string (e.g. `root/0/1/0`), so
sibling identity and seeds are independent of which branches survive. Changing early
stopping or child retention changes the tree shape but never shifts a surviving node's ID.

## Fill the leaves

The fill controls are identical to the region-quilt filler groups.

| Controls | What changes on the canvas |
|---|---|
| **Leaf filler** | One vocabulary throughout (hatch, motifs, contours) or an explicit mix of all three. |
| **Inset** | Clearance inside each retained terminal leaf. |
| **Leaf retention** | Stable omission without changing any subdivision cut. |
| **Source spacing** | Hatch interval or nested motif separation. |
| **Hatch direction** | Hatch angle in degrees. |
| **Line weight** | Shared thickness for hatches, contours, motif outlines and petals. |
| **Nested motif** | Point mark used in motif-filled leaves. |
| **Nested mark size** | Diameter of the nested point motif. |
| **Nested petals** | Number of petals when nested motif is a rosette. |
| **Nested field** | Replace the field inside each leaf without changing the subdivision or its material. |
| **Nested field frequency** | Spatial frequency, or hill placement offset, within each leaf. |
| **Nested contour material** | Material used on the nested leaf-local contours. |
| **Nested station spacing** | Spacing of contour stitches or beads. |
| **Nested bead motif** | Mark applied at each nested contour station. |
| **Nested bead size** | Diameter of a contour bead. |
| **Nested bead petals** | Number of rosette bead petals. |

## Try these

- Depth 5, min size 46, early stopping 0.3, child retention 0.9, mixed fillers, rosette
  nested motifs with 7 petals.
- Depth 3, min size 80, early stopping 0, child retention 0.7 — a sparse world with
  large negative-space regions.
- Depth 7, min size 14, all-contour fillers with ink material and dot beads — four levels
  of structure: cell leaf → contour → bead → mark.

```js
import {
  createInstrument, referenceComposition, regionTree, inside, regionFill,
} from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("recursive-cells"));
const tree = regionTree(recipe.source);
const terminalLeaves = tree.filter(n => n.terminal);

inside(p, terminalLeaves.map(n => ({ id: n.id, seed: n.seed, bounds: n.bounds })),
  regionFill(recipe.fill, recipe.palette));
```

`regionFill` accepts a `Region` with `id`, `seed` and `bounds`. Terminal nodes from
`regionTree` map directly to regions. The same `regionGeometry` and `regionFill`
consumers are used as region quilts, so leaf geometry is identical for the same bounds,
seed and fill spec.

The library does not create or clear a canvas. Source options use canvas units. Node count
is bounded by depth (max 4095 at depth 12). No polygon hole clipping is provided.

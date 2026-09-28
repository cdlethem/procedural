# Recursive Cell Worlds

Grow a rectangle into compartments within compartments: each cell may split again, and the
finished leaves are filled with hatching, motif populations or contour scores. Big quiet
cells and dense small ones sit side by side, and branches that stop early or are dropped
leave open paper.

## Grow the tree

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Width**, **Height** | The footprint of the cell world. |
| **Max depth** | How many times a cell may split. |
| **Min leaf size** | Cells whose shorter side is below this stop splitting, however deep they are. |
| **Early stopping** | The stable fraction of cells that stop growing regardless of size. Stopped cells stay large. |
| **Child retention** | The stable chance each deeper branch is kept. Dropped branches leave bare paper and never reroll their siblings. The first two cells are always kept. |
| **Cut axis** | Longest splits each cell across its length; random picks a direction per cell. |
| **Subdivision bias** | Negative keeps leaves near equal; positive contrasts big and tiny leaves. |

These are construction edits. Each cell has a path identity such as `root/0/1`, so dropping
or stopping one branch never changes another cell's cut or fill.

## Fill the leaves

The filler controls are the region-quilt filler controls: **Leaf filler** chooses hatching,
motifs, contours or a mix; **Inset** and **Leaf retention** shape the leaf; hatch, motif and
nested-contour settings are shown only when they apply. Contour leaves can carry their own
material, and bead materials carry their own mark.

## Try these

- Depth 6, min leaf 38, early stopping .12, retention .92, mixed fillers: the starting study.
- Depth 4, min leaf 80, retention .6: a few large fragments and wide margins of paper.
- Bias 1 with hatching only: one dominant field with slivers along its edges.

```js
import { createInstrument, referenceComposition, regionTree, inside, regionFill } from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("recursive-cells"));
const leaves = regionTree(recipe.source).filter((node) => node.terminal)
  .map((node) => ({ id: node.id, seed: node.seed, bounds: node.bounds }));
inside(p, leaves, regionFill(recipe.fill, recipe.palette));
```

`regionTree` returns a flat, parent-before-child array of `{ id, parentId, depth, bounds,
seed, terminal }`. Each cut reuses the partition used by region quilts, run on the cell's own
proportions. Tree size and the total filler work are bounded before drawing.

The library does not create or clear a canvas. Lengths are canvas units.

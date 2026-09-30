# Cell Division

A colony grows from a few founder cells inside a dish. Nutrient enters from a ring inside the wall,
spreads inward and is eaten by the cells; a cell that finds food grows and divides in two, and the
daughters push their neighbours aside. The starting picture is a disc of round cells coloured by how many
divisions they descend from: large, mostly newest cells in the fed rim, older and smaller ones packed in the
middle, thin ink lines tracing who divided into whom. Where the food was decides where the colony is
thick, where cells are big and where lines of descent run.

This is a flat, honest 2D model, not biology and not physics: discs, a diffusing field, a first-order
uptake law and overlap relaxation. It does not stand in for the 3D surface-growth study.

Everything drawn comes from one colony. Cells, family lines, nutrient contours and territories are four
readings of the same result, so changing colours, marks, which cells are shown, or the position of the dish
never re-runs the colony; changing food, seeds, division rules, mechanics or the number of steps does.

## What happens each step

1. **Growth.** Every cell that has not yet reached the division radius absorbs a share (*Uptake*) of the
   nutrient under it. One unit of nutrient becomes one unit of cell area, so the colony's area can only come
   from the dish, and cells sharing a patch of food share it.
2. **Diffusion, sources.** The nutrient spreads (*Diffusion*, in canvas units squared per step) with no
   flow through the wall. Source cells are held at full strength.
3. **Division.** A cell at the division radius becomes two daughters of the same total area. The larger takes
   the *Split* share and leads along the *Division axis*; they touch, and the centre of area stays put. They are
   new cells with new ids; the mother is kept as an ancestor.
4. **Relaxation.** Overlapping cells move apart (*Relaxation* passes of *Stiffness*); a large cell yields less
   than a small one, and the wall holds every whole cell inside.

The colony stops when it reaches the *Cell limit* and every cell is full-grown (settled), or when a dish
without a source has eaten all its food (starved). Cells never disappear.

## Shape the colony

| Controls | What changes on the canvas |
|---|---|
| **Nutrient source** | Where food enters: a ring inside the wall, an edge, one spot, two opposite spots, or none (a finite reserve that is eaten). The colony grows toward the source. |
| **Source direction / distance / size** | Which side an edge or spot is on, how far a spot is from the middle, how thick the source is. |
| **Reserve** | Food spread through the dish at the start. 0 makes growth wait for the supply to arrive. |
| **Diffusion** | Low keeps food near its source and the colony thin and edge-hugging; high evens the dish out. |
| **Field cell** | Resolution of the nutrient grid; finer costs more per step and does not change how fast food spreads. |
| **Width, Height, Center X/Y** | The dish and where it sits on the canvas. Moving it only translates the drawing. |
| **Seed layout / cells / X / Y / spread / angle** | The founders. Each founds a clan (colour by *root* shows them); separate clans meet in lines. |
| **Start radius, Division radius** | Size of a newborn founder and of a cell when it divides. |
| **Uptake** | Higher grows and divides faster, and starves the cells behind a growing front sooner. |
| **Cell limit** | Most cells; at the limit the colony fills and settles. |
| **Split** | 0.5 gives equal daughters; higher gives a big and a small one, so sizes differ from the first division. |
| **Division axis** | Random, along or across the food gradient (chains toward the food, or sheets across it), out from or around the colony's middle, or fixed. *Axis jitter* turns each division by a random angle. |
| **Boundary, Allowed overlap, Stiffness, Relaxation** | Dish shape, how far cells may overlap before being pushed apart, and how firmly. Low stiffness leaves a crowded colony soft and overlapping. |
| **Steps** | How long the colony has grown. Dragging it plays the colony forward and back; earlier states never change. |

## Draw it

| Controls | What changes on the canvas |
|---|---|
| **Youngest / Oldest shown** | Age selection: age is the share of the run a cell has existed (1 for founders). Hides cells outside the window; nothing moves. |
| **Color by** | Generation (divisions from a founder), age, size (smallest to largest in the colony) or founder, spread over the palette in order. |
| **Cells, Cell size, Cell weight** | Discs, outlines or outlines with a nucleus, drawn at each cell's own size (scaled by *Cell size*). |
| **Lineage, colour, weight, spacing, bead** | Lines from where each mother divided to each daughter, as ink, stitches or beads, in one colour or the daughter's. |
| **Nutrient lines, levels, weight** | Contours of the food that is left, evenly spaced between empty and full. |
| **Cell walls, reach, weights, hatching** | Each cell's nearest territory, cut to *Wall reach* radii, as outlines, hatching or both. Hatch direction turns by *Hatch twist* per generation, so line direction tells family depth. |

## Try these

- **Feeding front:** *Cell limit* 600, *Steps* 230: the default; then drag *Steps* to watch it spread inward from the rim.
- **Chains toward food:** *Source* edge, *Source direction* 180, seeds a *Seed layout* line at *Seed X* 0.12, *Division axis* gradient, *Color by* size.
- **Two clans:** *Source* pair, *Seed layout* scatter, 9 seeds, *Color by* founder, *Lineage* ink in the first colour.
- **A closed culture:** *Source* none, *Reserve* 0.5, *Diffusion* 80: it grows on what it has and stops.
- **Territories:** *Cells* none, *Cell walls* both, *Hatch twist* 25, *Color by* size.
- **Big and small:** *Split* 0.85, *Division radius* 20, *Cells* nucleated, *Color by* age.
- **Layers:** the colony is a transparent layer; put it over or under any other instrument.

## Use the pieces in code

```js
import { cellColony, cellSites, lineagePaths, nutrientPaths, cellWalls, wallHatch, motif, pathMaterial, atEach, strokeWith }
  from "@procedurals/instruments";

const colony = cellColony({ width: 560, height: 560, boundary: "dish", fieldCell: 8, source: "ring", sourceAngle: 0, sourceOffset: 0,
  sourceSize: 0.06, reserve: 0.3, diffusion: 100, seedLayout: "cluster", seedCount: 3, seedX: 0.5, seedY: 0.5, seedSpread: 16, seedAngle: 0,
  startRadius: 7, divideRadius: 13, uptake: 0.12, maxCells: 700, split: 0.6, orientation: "random", splitAngle: 0, orientJitter: 0,
  overlap: 0.05, stiffness: 0.5, relax: 4 }, /* seed */ 42, /* steps */ 230);

colony.cells;       // live cells: id, parent, root, birth, generation, radius, position (local frame)
colony.ancestors;   // divided cells, kept for the lineage
colony.lineage;     // a Graph: a node per cell that ever lived, an edge per birth (weight = area share)
colony.field;       // nutrient concentration on the grid (fraction of the supply)
```

Coordinates are the dish's own frame (origin at its top-left corner); the instrument translates it to the canvas.
`cellSites` (a site per cell with its radius, colour rule and age window), `lineagePaths`, `nutrientPaths`, `cellWalls` and
`wallHatch` are ordinary values for `atEach`, `strokeWith` and any `motif` or `pathMaterial`; `drawCellDivision(p, recipe,
{ cell, lineage, nutrient, wall, hatch })` replaces any treatment with your own callback while the colony stays the same
cached object. `colonyAt(colony, k)` reads an earlier step (replayed from the nearest checkpoint) and `prepareCellColony`
builds cooperatively with cancellation. Every bound throws an Error naming the control to change; nothing is thinned.
Host binding of a user-drawn nutrient map or seed layout is future work: saved instruments name only the scalar controls.

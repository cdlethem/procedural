# Cyclic Fronts

Bands of color that wind into spirals: a few pinwheels seeded on a quiet ground grow into interleaved
domains, each color pressing into the one before it, and where every color meets at a point the fronts curl
into a spiral wave. Drag **Steps** and the picture grows or rewinds; step 0 is the start and a few dozen steps
in the spirals are already colliding. The same grid is drawn three ways at once: flat color cells, the thin
lines where one color invades another, and a small ring at every spiral core. Each can be replaced, thinned
out or turned off without touching the others. A new seed places the pinwheels elsewhere.

**The rule is small and exact.** There are *States* colors arranged on a cycle, 0, 1, 2, … and back to 0. In one
step every cell looks at its neighborhood, all at once; a cell in state *s* becomes *s + 1* if at least
*Threshold* of its neighbors are already in *s + 1*, and otherwise keeps its color. A cell never moves backward or
skips a color, so the domain of *s + 1* invades the domain of *s*, and the line between them is a moving front.
The palette only paints the states: changing colors, fills, marks or line weights never re-runs the growth,
and changing the neighborhood, threshold, start or obstacles always does. A grid that cannot change any more
simply stays as it is (a tiny grid, a wall that shuts a wave in, a single invading train of stripes that has run
off the edge all end this way), and one that cycles keeps cycling; both are detected exactly and reported
through `cyclicFrontsProducts(...).summary`.

The model is a 2D cellular automaton on a bounded square grid. It is a study of the cyclic rule, not a chemical
simulation and not a claim to reproduce any particular artwork's process.

## Choose the rule and the time

| Controls | What changes on the canvas |
|---|---|
| **States** | How many colors interleave. Few states (3 to 5) make thin, hard-edged bands and tight scrolls; many (12 or more) make wide smooth ramps that take longer to come round. |
| **Neighbourhood**, **Range** | Who votes: a full square (Moore), a diamond (von Neumann) or a hollow ring at the chosen range. The shape decides what the fronts look like: Moore gives octagonal domains, the diamond gives 45-degree steps and mazes, the ring gives rounder, flowing ones. A longer range makes fronts smoother and domains larger. |
| **Threshold** | How many neighbors must already be in the next state. Low values let every front sweep on (3 of a 24-cell neighborhood grows clean spirals from pinwheels); at 6 of 24 a random start freezes into static speckle. A value above the neighborhood size is an error naming this control. |
| **Columns** | Cells across the width. More columns are finer fronts; rows follow the height-to-width ratio of Size, so cells stay square. |
| **Steps** | Synchronous updates from step 0. The slider reaches 300; larger values are entered by hand (up to 2000, within the work bound). |
| **Center X/Y, Width, Height** | Where the grid sits and how large it is. Scaling Width and Height together keeps the same grid; changing only their ratio changes the number of rows, and with it the picture. |

## Start, and obstacles

| Controls | What changes on the canvas |
|---|---|
| **Start** | **Seeded pinwheels** (the default), **Random cells**, **Stripes** or one **Designed stamp**. |
| **Density** | (Random cells) The share of cells that start in a random state; the rest start in state 0. With a low threshold a sparse start grows separate domains that press into each other; with a high one isolated cells cannot grow at all. |
| **Pinwheels**, **Seed size** | (Pinwheels) How many, and their radius in cells. The seed decides each one's place, turning direction and starting color; adding one leaves the others where they were. Seed size also sizes the stamp. |
| **Stamp**, **Stamp X/Y** | (Designed stamp) A single pinwheel, two counter-rotating pinwheels (an S of two opposite spirals), a target of concentric bands (one outgoing wave that sweeps the grid and stops), or three pinwheels braided around the center, and where it sits. |
| **Stripe width**, **Stripe angle** | (Stripes) Band width in cells and the direction in which the states increase. Straight stripes run off the grid and settle; add **Disturbance** to nucleate spirals. |
| **Disturbance** | (Pinwheels, stripes, stamp) The share of cells reset to a random state after the pattern. A little seeds spirals along straight fronts. |
| **Obstacles** | None, seeded **Blocks**, a **Ring wall**, **Barred walls** or **Lettering**. Obstacle cells never change and never vote, so fronts stop at them and curl round the ends of walls. |
| **Obstacle size**, **Obstacle count**, **Opening** | Block side or wall thickness; how many blocks or bars; the share of the ring or of each bar left open. A ring with no opening shuts its waves in. |
| **Lettering** | One to twenty printable ASCII characters, fitted across the grid as walls. |
| **Obstacle color** | Painted darker than the darkest palette color, lighter than the lightest, or not painted. |

## Draw the same grid three ways

| Controls | What changes on the canvas |
|---|---|
| **Cell fill**, **Fill opacity** | Flat rectangles merged by equal state, hatching whose angle turns by 180 / States from one state to the next, or nothing. Opacity below 1 can show faint seams between merged rectangles. |
| **Hatch spacing / weight / angle** | (Hatching) Distance between lines, their width and state 0's angle. Lines are anchored to the canvas, so neighbors of one state continue each other's hatching. |
| **Cell mark**, **Mark size / weight** | A dot, rings, rosette or arrow at every cell, colored and turned by its state (arrows and rosettes show the phase as a direction). Size is a fraction of the cell. |
| **Fronts** | The lines between different states: only **advancing fronts** (a state and its successor, the moving edges), or **fronts and defects** (add borders between states that are not neighbors on the cycle, which random starts leave behind), or none. |
| **Front material**, **Front color**, **Front weight**, **Stitch spacing** | Solid ink, stitches or beads, colored by the invading state or by the darkest or lightest palette color; state colors blend into a state fill, so use a dark or light front over one. |
| **Smoothing** | 0 follows the cell sides exactly; 3 relaxes them into flowing curves. Ends stay put, so fronts still meet at junctions. |
| **Earlier fronts**, **Steps between** | Draw earlier positions of the fronts, thinner the older they are, like ripples left behind. |
| **Core mark**, **Core reach**, **Core size / weight** | A mark at every spiral core: a place where all the states wind round one point. Reach is the radius, in cells, of the loop that tests for winding; **Core size** and **Core weight** scale together. Winding one way uses the first palette color, the other way the second. |
| **Colors** | The palette as a closed loop (neighbors are similar, the cycle has no seam) or palette entries repeated in order. |

## Try these

- **Labyrinth:** *Start* random cells, *States* 5, *Neighbourhood* diamond, *Range* 2, *Threshold* 2, *Steps* 100, *Fronts* fronts and defects.
- **Thin scrolls:** *States* 3, *Range* 2, *Threshold* 2, *Pinwheels* 7.
- **Two opposite spirals:** *Start* designed stamp, *Stamp* counter-rotating pair, *Steps* 60.
- **A wave through a gate:** *Obstacles* ring wall with *Opening* 0.12, *Pinwheels* 3.
- **Ripple map:** *Cell fill* none, *Front color* by invading state, *Earlier fronts* 6, *Steps between* 6, *Front weight* 1.6.
- **Beaded contours:** *Cell fill* none, *Front material* beads, *Stitch spacing* 4.5.
- **Phase field:** *Cell fill* none, *Cell mark* arrow, *Columns* 60, *Fronts* none.
- **Letters in the current:** *Obstacles* lettering, *Pinwheels* 9, *Steps* 45.

## Use the pieces in code

The instrument is these functions. The model is a stateful snapshot (a deterministic run that keeps checkpoints), and
every treatment reads the same grid.

```js
import { cyclicSimulation, runSimulation, cyclicGrid, gridGeometry, stateRegions, frontPaths, spiralCores,
  obstacleRuns, strokeWith, atEach, motif, pathMaterial, inside } from "@procedurals/instruments";

const construction = {
  columns: 64, rows: 64,
  rule: { states: 8, threshold: 3, range: 2, neighbourhood: "moore" },
  initial: { kind: "spirals", count: 4, radius: 10, noise: 0 },
  obstacles: obstacleRuns(myPlanarShape, 64, 64),     // any region or domain, in cell units; or { kind: "none" }
};
const snapshots = runSimulation(cyclicSimulation, construction, 42, { steps: 80 });
const grid = cyclicGrid(snapshots);                    // the grid after step 80; cyclicGrid(snapshots, 40) rewinds
const geometry = gridGeometry(64, 64, { centerX: 320, centerY: 320, width: 512, height: 512 });

const fronts = frontPaths(grid, geometry, { kinds: "advance", smoothing: 2, seed: 42 });   // Path values with from, to, kind
strokeWith(p, fronts, pathMaterial({ kind: "ink", weight: 1.2, spacing: 6, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 2, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, myColors));
atEach(p, spiralCores(grid, geometry, 42), myMark);    // Site values with winding +1 / -1
inside(p, stateRegions(grid, geometry, 42), (surface, region) => { /* region.state, merged rectangles */ });
```

`cyclicFrontsComposition(input)` resolves the named instrument to a plain descriptor and `drawCyclicFronts(p, recipe,
{ fill, cell, front, core })` replaces any treatment with an ordinary callback while the grid, regions, paths and
sites stay the same cached objects. Results are frozen; the typed arrays are read-only by convention. The library
never fetches or decodes and never clears a canvas. Host-supplied obstacle masks and initial grids are resolved
values for this direct API; the saved instrument names only the bundled starts and obstacles, and binding your own
image or shape to a saved instrument is future host work.

## Limits

Steps times cells times (neighborhood size plus two) may not exceed 800 million work units, the grid is at most 240
by 240 cells, States 3 to 24, Range 1 to 6. Over a limit the error names what to lower (**Steps**, **Columns**,
**Range**, or the ratio of **Width** and **Height**) and nothing is truncated. A drawing may spend at most 900,000
mark operations; over that, the error names **Columns**, **Earlier fronts**, **Stitch spacing** or **Hatch spacing**.
On a development machine the default draws in about 35 ms, the slider maximum (160 columns, 300 steps) in about 135 ms,
and a palette edit in about 1 ms.

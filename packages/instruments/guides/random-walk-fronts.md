# Random Walk Fronts

Patches of colour creep across part of the canvas. The starting picture is a disc of ragged territories in four
colours, each grown from its own seed by a few walkers that wander, claim the cells they step on, and split into
new walkers as they go. The walk is caught mid-growth: paper still shows in holes and along the outer edge, the
newest cells are lighter than the old, and thin lines trace where the front stood every ten steps. Drag *Steps*
and the same walk grows or shrinks cell for cell; a longer walk only ever adds to a shorter one.

Nothing is painted outside the **region**. The region can be a shape, the letters of a word, the pixels of a bundled
image whose tone lies in an interval, or any of these with a **barrier** cut out. A piece of the region that no
seed reaches stays bare paper, so islands and letters each need a seed of their own (*One per region* does that).
This is stochastic region visitation, not water or pigment transport: the colours never mix and nothing flows.

## How the walk runs

The region is a lattice of cells. Each **seed** claims its cell for a colour and starts one or more **walkers**. In
every step each walker, in birth order, takes one step to a neighbouring cell. Only an *unclaimed* cell is ever
claimed: the walker takes it for its current colour and records the step. A walker that claims a cell may also spawn
a child on it. Walkers die when they are boxed in, or after *Patience* steps in a row without a claim. The walk
stops when the region is full, when the coverage you asked for is reached, when no unclaimed cell touches a claimed
one (growth is impossible), or when every walker has died. Steps after that change nothing, and the published state
says which of the four happened.

## The controls

| Group / control | What changes on the canvas |
|---|---|
| **Region: Region** | The part of the canvas that can be claimed: the whole lattice, a disc, a ring, several islands, five chambers joined by corridors, a word's letters, or an image's tone band. |
| **Region size, Ring width, Islands** | How large the shape is (fraction of the lattice's shorter side), how thick the ring is, how many blobs. Only the controls of the chosen shape show. |
| **Word** | The letters (1 to 20 printable characters), fitted into the lattice. Counters such as the hole of an A stay empty. Thin strokes need a high *Patience* to fill completely. |
| **Source image, Tone from / to** | Which bundled synthetic picture is thresholded, and the lightness interval that counts as region. Narrow intervals give several separate pieces (the portrait's tone bands read as a head). Your own image is future host work; the library functions accept any mask you build. |
| **Barrier** | Cells cut out of the region: a wall with a gap the front squeezes through, an enclosure whose sealed inside stays bare unless a seed lands in it, or a grid of pillars. Its thickness, gap, size and spacing controls show for the chosen barrier. |
| **Placement: Center X/Y, Columns, Rows, Cell size** | Where the lattice sits and how fine it is. Columns and rows change the walk (more cells, finer fronts, more steps to fill them). Center and cell size only move and scale the drawing: the walk is the same. |
| **Seeds: Seed layout, Seeds, Walkers per seed** | Where the walk starts and how many walkers each seed has. Scatter, grid and ring spread seeds; *One per region* puts one in each connected piece, largest first. The layer seed picks scatter positions and every walker's choices, so a new seed is a different growth. |
| **Walk: Neighbours** | 4 sides, or 8 with corners (fronts creep across diagonal pinches and join diagonal pieces). |
| **Persistence, Explore** | How straight walkers run, and how strictly they prefer unclaimed cells (Explore 1: greedy, a clean advancing front; low: they wander through claimed ground first, giving slow ragged fronts). |
| **Revisit rule** | *Avoid*: never steps on a claimed cell, so it dies boxed in and leaves thin branching dendrites. *Cross own colour*: may cross its own territory but never a rival's, so patches abut. *Cross anything*: every reachable cell is eventually filled. |
| **Branching, Maximum walkers, Patience** | How often a claim spawns a child; the most walkers alive at once (a birth beyond it simply does not happen); how long a walker may go without a claim. |
| **Color: Colors, Colour transition, Shift chance** | How many palette colours are in play (the palette entry after them is the *ink* for lines and marks). Inherit keeps one colour per seed; Cycle moves along the palette as a walker claims cells, so hue drifts along branches; Random jumps. Small shift chances (0.005 to 0.03) give long same-colour runs. |
| **Growth: Steps, Coverage stop** | How many rounds run (up to 20,000; the slider covers 0 to 2,000), and the fraction of the region at which the walk stops. |
| **Fill** | *Flat colour* paints each colour's territory; *Age bands* cuts it into bands of *Age interval* steps and tints them so the youngest stands out (*Band contrast*, negative darkens instead); *None* leaves paper. *Merged polygons* are exact shapes with holes; *Row runs* are pixel rectangles. |
| **Lines** | Territory borders, front-age contours (nested outlines of everything claimed before step k times the age interval), or both, drawn as ink, stitches or beads. *Line colour* is the ink entry, or the territory colour (contours step through colours with age). |
| **Hatching** | Scan lines inside each territory; each colour's angle is the previous one plus *Hatch turn*, so neighbouring territories read differently. |
| **Marks** | A dot at every claimed cell on a lattice of *Mark spacing*, coloured by owner; *Mark aging* makes the newest smaller. The claimed region acts as the mask for the dots. |
| **Growth tips** | Rings at the seeds and dots where live walkers stand at this step: useful while dragging *Steps*. Nothing shows after the walk has ended. |

## Try these

- **Ragged front:** the default; then *Steps* 40 to 200 to watch it fill, and *Age interval* 5 for finer bands.
- **Circuitry:** *Revisit rule* Avoid, *Persistence* 0.85, *Branching* 0.03, *Colors* 4, *Colour transition* Inherit.
- **Letters that grow:** *Region* Letters, *Seed layout* One per region, *Seeds* 8, *Revisit rule* Cross anything, *Patience* 400, *Steps* 400, *Columns* 128, *Rows* 64, *Cell size* 4.6.
- **Islands, one colour each:** *Region* Islands (14), *Seed layout* One per region, *Colour transition* Inherit, *Fill* Flat at 0.35 opacity, *Hatching* on, *Lines* Territory borders in territory colour.
- **A face from tones:** *Region* Image tones, *Source image* Portrait, tones 0.15 to 0.5, *Seed layout* One per region, *Marks* on, *Lines* Front-age contours as stitches.
- **The sealed pocket:** *Region* Open lattice, *Barrier* Enclosure with *Gap* 0, *Seed layout* Ring: the inside stays paper.
- **Squeezing through:** *Barrier* Wall with a gap of 3 cells and *Neighbours* 8.
- **Layers:** the drawing is transparent. Put it over or under Contour Scores, Region Quilts or Graph Roles.

## Use the pieces in code

The grid, the walk, the published field and each consumer are ordinary functions; the named instrument is these
same functions.

```js
import { walkGrid, walkFronts, frontsField, territoryDomains, bandDomains, frontContours, territoryHatching, frontSites,
  pathMaterial, strokeWith, atEach, motif } from "@procedurals/instruments";

// The region: any planar domain in cell space (x in [0, columns], y in [0, rows]), a raster mask, or a bundled source.
const grid = walkGrid({ kind: "domain", domain: { outer: [[2, 2], [58, 2], [58, 38], [2, 38]], holes: [[[20, 10], [40, 10], [40, 30], [20, 30]]] } },
  { kind: "none" }, 60, 40);

const rules = { neighbourhood: 4, persistence: 0.3, explore: 0.8, revisit: "own", branching: 0.08, maxWalkers: 120, patience: 60,
  walkersPerSeed: 2, colors: 3, transition: "cycle", shift: 0.004, coverage: 1,
  seeding: { layout: "cells", cells: [[5, 5], [55, 35]] } };   // or { layout: "scatter" | "grid" | "ring" | "region", count }

const snapshots = walkFronts(grid, rules, /* seed */ 7, { steps: 150 });   // cached; the same object for the same construction
const field = frontsField(snapshots, grid);   // owner, age, claimed, open, seeds, walkers, ended: { reason, step } | null

const frame = { centerX: 320, centerY: 320, cell: 8 };
strokeWith(p, frontContours(field, frame, 15, 7, null), pathMaterial(inkSpec, palette));   // nested age isochrones
strokeWith(p, territoryHatching(field, frame, { spacing: 4, angle: 45, turn: 30 }, 7, null), pathMaterial(inkSpec, palette));
atEach(p, frontSites(field, frame, { stride: 2, aging: 0.5 }, 7), motif(dotSpec, palette));
for (const { color, band, domain } of bandDomains(field, frame, 15)) { /* exact polygons: fill them however you like */ }
```

`field.owner[y * columns + x]` is 0 for an unclaimed cell and colour + 1 otherwise; `field.age` is the step the cell was
claimed (0 for seeds). The walk never reads a palette, a mark or a material, so changing any of them repaints the same
snapshots object; changing the region, barrier, lattice size, rules, layer seed or step count runs the walk again, and
only more or fewer steps reuse the cached run. `drawWalkFronts(p, recipe, { mark, line, hatch })` replaces a consumer with
your own callback. Every length is in canvas units except the walk, which is in cells and steps.

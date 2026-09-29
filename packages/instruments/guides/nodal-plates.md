# Nodal Plates

Grains gather along the quiet lines of a standing wave. The study adds up to four standing-wave modes of a
plate, finds where the sum is zero (the nodal lines) and where it is small (the node bands), and scatters
grains toward those places, so sand-on-a-plate figures appear: bare lobes, crowded lines and dense knots
where several nodal lines cross. The starting study is a square plate with the classic pair of a mode and
its swapped partner (3 lines across by 5 down, minus 5 across by 3 down), grains coloured by which side of
a nodal line they sit on, and the nodal lines in thin ink.

It is a **mathematical plate study, not a vibration simulation.** The modes are the ideal scalar
standing waves of the plate (cosines and sines of the width and height, or Bessel functions of the
radius). Real plates obey a fourth-order equation with different modes and frequencies, and grains on a
real plate obey physics this study does not model. Use it for the figures, not for predictions.

Lines, bands and grains all come from one field. Recolouring, changing the grain mark, the line material
or the band opacity never moves anything; a different seed only re-deals the grains; a different mode,
plate or Node width builds new geometry.

## Choose the plate and its edge

| Controls | What changes on the canvas |
|---|---|
| **Plate** | **Square**, **Rectangle** or **Circle**. Rectangle modes are cosines or sines of the width and height; circle modes are Bessel functions of the radius times a cosine of the angle. |
| **Edge** | One boundary condition for every mode. **Free**: the slope across the edge is zero, so nodal lines meet the edge squarely and the edge is not a node. **Fixed**: the edge itself is a node (the plate is clamped); the picture is drawn inside it and its sign flips across each interior line. The two are never mixed on one plate. |
| **Center X/Y**, **Width/Height**, **Rotation** | Position and size (width is the side of a square and the diameter of a circle; Height only exists for a rectangle) and a turn in degrees. |
| **Outline** | Draws the plate's edge. |

## Choose the modes

Each mode is described by two indices that **count interior nodal lines**, so they mean the same for both
edges: **Index n** is the number of lines across the width (for a circle, nodal diameters) and **Index m**
the number across the height (for a circle, nodal circles inside the edge). Under a free edge, `n = m = 0`
is the uniform mode with no nodes.

| Controls | What changes on the canvas |
|---|---|
| **Modes** | One to four modes added together. One mode is a pure standing wave: a regular grid of lines on a rectangle, or rings and spokes on a circle. Two or more interfere. |
| **Weight** | Signed share of each mode. Only ratios matter; a negative weight flips the mode. The classic figure is a mode minus its swapped partner. Hidden for a single mode. |
| **Phase**, **Time** | Each mode turns as `weight × cos(2π·time·k/k₀ + phase)`, where `k` is its wavenumber and `k₀` that of the lowest mode. Modes with equal wavenumbers (n and m swapped on a square) keep one figure whatever Time is; on a rectangle, or with different indices, the nodal figure moves as Time advances. A phase of 90° at Time 0 silences a mode; if everything cancels you are told to change a weight, phase or time. |
| **Orientation** | Circle only: turns a mode's diameters about the center. Modes with no diameters (n = 0) are round. |

## Nodes, grains, lines and bands

| Controls | What changes on the canvas |
|---|---|
| **Node width** | Half-width of the node band as a fraction of the peak amplitude. Small values pull grains tight onto the lines (but allow fewer of them); large values fatten the band and the fill. |
| **Line resolution** | Sample cells across the plate for the nodal lines and band fill. Crossings of two nodal lines are resolved to one cell: at a crossing the two curves touch or bounce like any marching-squares saddle, visible only at thick line weights and coarse resolution. |
| **Particles**, **Separation** | The number of grains, and the least distance between two of them. Raising Particles only adds grains; the earlier ones do not move. A request that cannot be met (too many grains for so narrow a band, or a Separation that leaves no room) is refused with the control to lower, never silently truncated. |
| **Grain mark**, **Grain size**, **Grain line weight**, **Petals**, **Opening**, **Size variation**, **Grain retention** | The mark at each grain (dot, ring, rosette, arrow) and its shape. Retention keeps a share of grains chosen per grain without moving any. |
| **Grain color** | **Single** uses palette colour 1; **By lobe** uses colours 1 and 2 for the two signs of the field either side of a nodal line. |
| **Follow node** | Rosette and arrow only: turn each grain to the direction of the nodal line beside it. |
| **Nodal lines**, **Line material**, **Line weight**, **Station spacing**, **Bead size** | The exact zero set drawn as solid ink, tangent stitches or beads (colour 0). |
| **Node bands**, **Band opacity** | Fill the region within Node width of a line as one shape (colour 3, wrapping on shorter palettes). Under a fixed edge the band also runs along the whole edge. |

The layer is transparent; bands, outline, lines and grains draw in that order.

## Things to try

| Setting | Result |
|---|---|
| Square, free, Modes Two, (3, 5) and (5, 3) with weights 1 and −1 | The classic figure with a diagonal and a fourfold star. Try weights 1 and +1 for its sibling. |
| Circle, Modes One, n = 6, m = 2 | Twelve spokes and two rings, with dense sand at the center where every spoke meets. |
| Rectangle 580 × 320, Modes Two, (2, 3) and (3, 2), Time 0.35 | The swapped pair has different wavenumbers on a rectangle, so the figure drifts and folds as Time advances. |
| Fixed, Modes One, (2, 1), Node width 0.2, Node bands on | A 3 × 2 quilt of lobes with a band along every line and the edge. |
| Particles 0, Line material Beads | The nodal lines alone as a chain of beads. |
| Grain mark Arrow, Follow node, Separation 8, few Particles | Arrows that trace the flow of the lines. |

## As functions

```js
import { nodalField, nodalPaths, nodalSites, nodalBands, atEach, strokeWith, pathMaterial, motif,
  createCompositionRun } from "@procedurals/instruments";

const field = nodalField({ shape: "square", edge: "free", centerX: 320, centerY: 320, width: 480, height: 480, rotation: 0,
  modes: [{ n: 3, m: 5, weight: 1, phase: 0, orient: 0 }, { n: 5, m: 3, weight: -1, phase: 0, orient: 0 }], time: 0, resolution: 160 });
field.amplitude(300, 260);                       // analytic value in [-1, 1]; NaN outside the plate
const lines = nodalPaths(field, 7);              // frozen Paths `nodal:<k>`, for strokeWith / pathMaterial
const grains = nodalSites(field, { seed: 7, tolerance: 0.05, particles: 2000, separation: 2 });   // Sites `grain:<k>`
const bands = nodalBands(field, 0.05);           // a PlanarDomain: the node band, holes and all
const run = createCompositionRun();
strokeWith(p, lines, pathMaterial({ kind: "ink", weight: 1, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x1c2430]), run);
atEach(p, grains, motif({ kind: "rings", size: 7, petals: 6, opening: 0.4, weight: 1, rotation: 0, variation: 0, retention: 1 }, [0x1c2430, 0xb8452f]), run);
```

Each grain also carries `amplitude`, `proximity`, `nodeDistance` (a first-order estimate, not a bound) and `lobe`, and its
`angle` follows the nodal tangent, so any mark or your own callback can read them. The bands are an ordinary planar domain:
clip or offset them with the domain functions, or fill them with a region filler. The instrument itself only names a plate,
an edge and a short mode list; binding your own measured mode shapes to a Studio layer is future host work.

## Limits

Sampling is at most 480 cells across the longest side and 300,000 cells in all; up to eight modes with indices to 24 through
the functions (four modes, indices to 24, in the instrument); up to 20,000 grains and 2 million candidate points. Lines
shorter than three quarters of a cell are below the resolution and dropped. Circle modes read their radial function from a
Hermite table accurate to 1e-8 for wavenumbers up to 80; the Bessel functions themselves are accurate to 1e-13 up to
|x| = 100. A very dense circle mode at the highest resolution can exceed the contour-assembly bound and is refused with
Line resolution and the mode indices named.

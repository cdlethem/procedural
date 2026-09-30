# Laplacian Fronts

A lobed blob grows outward through rings of age-colored fronts. Where the blob sticks out, the front runs
ahead and the tips draw away from the body; where it is tucked in, growth stalls. The starting picture is a
five-lobed seed in the middle of the canvas, surrounded by a far ring of source, with about twenty fronts
stroked from the seed to the present edge, bands of fill between them whose tone follows the age of the front
that bounded them, and a heavier final edge. A new seed changes the lumpy disorder that decides which lobes win.

This is **not random aggregation and not an offset of a contour**. The picture is built by solving a potential
between the growing region (potential 0) and the source (potential 1), then moving every point of the boundary
at a speed that follows the local potential gradient (the flux). Set *Growth bias* to 0 and every point moves
at the same speed: that is an offset of the seed and the lobes stay lobes. At 1 the tips, which draw more flux,
run away from the body.

The model is two-dimensional and on a square grid. It is a moving-boundary construction in the family of
Hele-Shaw and dielectric-breakdown growth, not a physical simulation of any material.

## How it is made

1. **Boundary conditions.** A source (a far ring, the frame, one side, or point sources) holds potential 1.
   Optional sinks are absorbers at 0, optional barriers are insulating. The canvas edge is insulating where it is
   not a source. The seed region is occupied and at potential 0.
2. **Potential solve.** Laplace's equation on the free cells, by red-black over-relaxation, until the residual
   (largest gap between a cell and the mean of its neighbours, against a potential drop of 1) is below *Solver
   precision*. If *Solver iterations* is not enough the drawing fails and reports the residual, sweeps and the
   controls to change; it is never drawn from an unfinished solution.
3. **Flux-driven advancement.** Each front cell moves at (normalized gradient)^η minus *Surface tension* times
   the curvature; the fastest cell moves *Step size* cells per step. Excess fill is passed on, never dropped.
4. **History.** The front after every step is kept as closed paths from marching squares, so fronts that merge
   or split, and pockets that close, remain valid closed loops (a front that meets the insulating canvas edge is
   an open chain). When no growth is possible (no flux, or surface tension holds every point) growth stops, and
   the earlier fronts stay exactly as they were. Growth also stops when the front reaches a source (a cell
   beside the source is taken): the circuit is closed, and the last front is the one that touched it.

Changing the palette, the front material, which fronts are drawn, the fill, the marks or the potential lines
repaints the same computed run. Changing the seed shape, sources, sinks, barriers, growth bias, surface tension,
step size, noise, grid, solver settings, steps or the seed recomputes.

## Controls

| Group | Controls | What changes on the canvas |
|---|---|---|
| **Seed** | Seed shape, Lobes, Lobe depth, Seed discs | The starting region: disc, lobed disc, cluster of discs, necklace, bar. Lobes decide where the first tips form. |
| **Placement** | Seed X/Y, Size (Seed radius, Seed spread), Seed angle | Where the seed sits and how big it is; a seed smaller than the surface tension never grows. |
| **Source** | Source, Source radius/size/points/side/angle | Where the flux comes from. A ring feeds all sides; one side makes a one-sided dendrite; points make growth lean toward each. |
| **Sinks** | Sinks, Sink discs, Size (sink size, ring), Sink angle | Absorbers that steal flux: growth leans away from them and leaves bare space around them. |
| **Barrier** | Barrier, Wall angle/offset, Widths (wall, gap), Wall gaps, Pillars, Pillar size | Insulating walls and pillars; fronts funnel through gaps and split around pillars. |
| **Growth** | Steps, Growth bias, Surface tension, Step size, Noise | How far it grows; how strongly tips run ahead; how round the tips stay; how finely it follows the flux; how uneven the ground is. |
| **Solver** | Grid, Solver precision, Solver iterations | Resolution of the potential and front (finer resolves thin fingers, costs much more), and the residual the solve must reach. |
| **Fronts** | Front material, Front interval, First/Last front, Line weights, Stitch spacing, Bead size, Front smoothing | Which historical fronts are stroked and with what: ink, stitches or beads; each is tinted by its age along the palette. |
| **Fill** | Fill, Fill opacity, Fill bands | The occupied region as one tone or as age bands (oldest inside). |
| **Marks** | Marks, Mark shape, Mark size, Mark spacing, Tip threshold, Mark retention | Motifs by age over the region (small and dark where old), or at the tips pointing the way the front runs. |
| **Boundary lines** | Boundary lines, Boundary weight | Outlines of the walls, pillars and sinks, so the reason a front bends is visible. |
| **Potential lines** | Potential lines, Potential levels, Potential weight | Equipotential lines of the final field; they crowd where the flux is strong. |

Controls that only matter for a choice are hidden until it is made (lobes only for the lobed seed, wall controls
only for a wall, and so on); their values are kept.

## Try these

- **Offset, not growth:** *Growth bias* 0, *Surface tension* 0, *Noise* 0: the fronts are evenly spaced copies of the seed.
- **Fingers:** *Growth bias* 2.5, *Surface tension* 2, *Steps* 150: a few sharp fingers hunt the source.
- **Rounded lobes:** *Growth bias* 1, *Surface tension* 20: the tips stay blunt.
- **Dendrite from one side:** *Source* edge (top), *Seed shape* bar near the bottom.
- **Around obstacles:** *Barrier* pillars or a wall with gaps.
- **Tips as marks:** *Marks* tips, *Mark shape* arrow, *Fill* none.
- **Lattice bias:** at *Growth bias* 2 and above on a plain disc with little noise, fingers line up with the grid axes; the square grid is part of the model. Noise, a lobed seed rotated off the axes, or a finer *Grid* reduce it.
- **Layers:** transparent layer; put it over or under Contour Scores or Sand Deposition.

## Use the pieces in code

```js
import { growthSnapshots, growthFrontPaths, growthOccupiedRegion, growthPotentialField, growthDiagnostics,
  growthTipSites, strokeWith, pathMaterial } from "@procedurals/instruments";

const spec = { grid: 96, seedShape: "disc", seedX: 320, seedY: 320, seedRadius: 30, seedLobes: 1, seedDepth: 0, seedCount: 1,
  seedSpread: 0, seedAngle: 0, source: "ring", sourceRadius: 300, sourceSize: 0, sourceCount: 1, sourceSide: "top", sourceAngle: 0,
  sinks: "none", sinkCount: 1, sinkSize: 0, sinkRing: 0, sinkAngle: 0, barrier: "none", barrierAngle: 0, barrierOffset: 0,
  barrierWidth: 0, barrierGaps: 1, barrierGapWidth: 0, pillarCount: 1, pillarSize: 0, noise: 0.3,
  eta: 1.4, tension: 4, stepScale: 0.5, tolerance: 1e-7, maxIterations: 600 };
const run = growthSnapshots(spec, 42, 100);        // cached by construction
growthDiagnostics(run);                            // residualMax, iterationsMax, work, stopped, area
const fronts = growthFrontPaths(run, 60);          // frozen Path[] of the front after 60 steps
growthOccupiedRegion(run);                         // planar domain of the final region, pockets as holes
growthPotentialField(run);                         // scalar potential, 0 in the region and 1 at the source
growthTipSites(run, 0.4);                          // Sites at the fastest tips, angle = outward normal
```

The library never fetches or clears a canvas. Lengths are canvas units. Binding a user's own boundary mask or
region as a saved input is future host work; the direct API accepts the layout described in the code.

# Momito: root composition walkthrough

Status: **plausibly supported at structural/technique fidelity**, not demonstrated and not
source-pixel compatible. Root read the full report and decisive active generate/subdivide
source at upstream69bdd8513e4482a5e6018e36887d4bc208660eb5, including later commented sections,
and compared the accepted quadrant-partition and Delaunay contracts. Native execution of this
whole composition is still required before crediting a demonstrated original recreation.

## Defining computations and package composition

1. Generate a centered960×960 rectangle with290 replacements and selectionFraction0.5 using
   QuadrantPartition2D. The source selects from the first half of the ordered leaf list and
   appends TL/TR/BR/BL children before removing the parent. The contract supplies that policy.
   The result has871 leaves:1+3*290. The report's approximately1161 figure is erroneous; leave
   the original survey note intact and cite the source correction here.
2. Read each leaf's endpoints to compute its center and minimum span. Center calculation and
   size-to-height arithmetic are ordinary composition glue. Keep input order and cell-size
   metadata available alongside the points.
3. Delaunay2D triangulates the center points. The artist does not implement triangulation or
   any predicate/edge-flip algorithm. Its input-to-canonical-vertex mapping preserves access
   to point metadata where needed.
4. Draw the source's local relief pattern from each face: two vertices at height4, the third
   at0, followed by two triangles spanning the first edge down to0. This is nine explicit
   vertex calls, not a closed solid or general extrusion algorithm. Root classifies this
   particular face treatment as artistic drawing glue. No new public mesh builder is needed
   to demonstrate it; a future reusable mesh transform would require separate motivation.
5. Select about90% of cell centers and draw native boxes whose height is minimum span*0.08*3.8
   and width/depth are height*0.02. Selection and height mapping remain explicit scene choices.
   Camera, lights, one palette color per frame and the per-box transforms are Processing glue.

The source also computes a triangulation of the selected wire points whose drawing is
commented out. Recreating the visible composition need not repeat that unused computation.
Postprocessing shader calls and other alternative drawing blocks are also commented out.
The active result requires P3D lighting/depth, not a shader or toxiclibs operation.

## Material fidelity limits

The package uses its explicit private RNG and binary64 partition arithmetic rather than
the source's shared Processing stream and binary32 values. Expect different specific cells,
spike choices and camera jitter at a matching seed. Retain the biased subdivision policy,
center triangulation, sloped face treatment, size-linked spikes and oblique lit view as the
structural recreation predicates; do not promise exact scene coordinates or pixel identity.

Delaunay cocircular tie resolution and canonical face vertex order can differ from the source
library. Which face vertex is lowered affects the visible relief. A recreation must declare
its deterministic vertex-role rule and show that the resulting relief retains the intended
faceted character; silently claiming identical wedge orientation would be wrong.

No measured parameter variants exist in the momito report. Source values are authored
recreation settings, not newly recommended library ranges. The report records unavailable
pixelDensity2 on the survey display; a new P3D environment must declare its actual density.

## Next check

After the cohort comparison, root can select this as one complete recreation with zero new
operations: an independent editable example using the accepted installed JAR, preserving all
of the defining visible components above. Compile and inspect canonical geometry, then perform
one scoped native P3D visual acceptance with declared edits. No new API, render or demonstrated
coverage claim follows merely from this walkthrough. Human usability remains untested.

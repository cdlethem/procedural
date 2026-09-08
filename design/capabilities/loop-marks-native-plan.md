# LoopMarks native acceptance plan — CP16

Pre-render plan for geometry.closed-spline-2d. Technique fidelity on JAVA2D; no whole-source,
P2D, generic polygon-fill, font or port support claim. databol motivates tangent tiles;
blobs motivates parameter-sampled fan drawing. Per-chord distance inversion and analytic
raw tangents deliberately differ from source per-span lookup and finite-difference direction.

Actual editable PDE at packages/java-processing/examples/LoopMarks/LoopMarks.pde;640x640,
density1, four explicit6-control loops with32 chords/span. Caller Java Random(42) chooses
radial artwork, not core state. T moves control1 of each loop by(+42,-32), C changes only
palette, M uses the retained curves for192 parameter-sampled fans instead of approximate
18-unit distance-spaced tiles,0 resets, S saves the cached display. All constants are
artwork, not public defaults, recommended ranges or exact spacing promises.

Use existing registered starter runner and the shared machine lease. Five draw states:
baseline, moved, recolored, fans, reset; injected keys tcm0s. Require actual public class
code source equals candidate/extracted JAR; renderer and dimensions correct; exactly five
draws and ordered events. Record exact hashes of each curve's descriptor, length and256
parameter plus256 distance samples (all four output components). T must rebuild every
curve and change the geometry hash. C/M must preserve the array AND a cloned snapshot of
individual curve identities and exact geometry. Reset restores baseline geometry/pixels.

All frames nonblank and opaque, actual framebuffer equals cached image, each edit visibly
changes pixels, and saved PNG equals final display after at least300ms without another draw.
Root inspects baseline, moved, recolored and fans: oriented separated tiles must follow
smooth closed loops; the control edit must visibly reshape them; the fan view must be a
legible distinct use of the same curves. Numerical/core checks remain separate.

Before release compile all extracted starters and run this native sequence from the
extracted JAR; compare all five images plus saved image to reviewed candidate pixels.
No acceptance from a worker pass or compilation alone. Do not modify criteria after seeing
candidate frames; diagnose and correct failed behavior while preserving attempts.

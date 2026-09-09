# Spring marks in the browser

This source-checkout starter retains a 7x7 `motion.target-springs-2d` grid with a fixed
`topology.delaunay-2d` connectivity, an authored disturb impulse, and a 121-sample
bounded trail history. It is the only animated workflow in this batch: the sketch's
`draw()` loop advances one logical spring step per frame only while running, matching
`SpringMarks.pde`/`SpringComposition.java`'s pause-by-default, explicit-tick design.

The JS `motion.target-springs-2d` core exposes a pure `{state, targets} -> nextState`
transition rather than Java's mutable `create()` + `step()` object (a deliberate,
documented divergence already used by every other target-springs port in this
repository); this composition reassigns its retained motion state each step instead of
mutating in place, preserving the same atomicity Java gets from its own try/finally
(if the core throws, the composition's fields stay at the previous sample).

Open `index.html` (served from the repository-local pinned p5 runtime; see
`tools/serve_spring_marks.mjs`), or use the on-page buttons/keys:

- `Space`: run / pause the animation loop
- `.`: step once while paused
- `D`: disturb the retained targets (pull nearby bodies outward)
- `M`: dots / velocity / fixed-wire draw mode (restyle only)
- `C`: base / alternate palette (restyle only)
- `H`: toggle bounded trails (restyle only)
- `T`: toggle target guides (restyle only)
- `K`: toggle spring strength (0.025 / 0.05); replaces coefficients via `response()`
- `V`: toggle spring retention (0.7 / 0.9); replaces coefficients via `response()`
- `0`: reset motion and history without rebuilding the fixed connectivity
- `S`: save the already displayed canvas to a PNG

This starter is not a browser-native conformance or reproduction claim; it is a scoped
port of the accepted SpringMarks composition's mechanism to p5.js.

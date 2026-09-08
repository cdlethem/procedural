# Path marks in the browser

This source-checkout starter retains 24 public gradient paths, then draws either their
independent movement segments or perpendicular endpoint marks. It uses the versioned
internal p5 Canvas2D frame adapter already used by the browser Field marks starter.

Serve this directory together with `packages/javascript/src/` and pinned p5 2.3.2, mapping
the p5 script to `/p5.js`. Open `index.html`, then use the visible controls or keys:

- **M** switches movement segments and marks.
- **L** switches mark length between 12 and 24 without rebuilding movement.
- **C** switches palettes without rebuilding movement.
- **N** switches 2,000 and 2,001 steps and rebuilds movement.
- **D** switches distance 0.4 and 0.8 and rebuilds movement.
- **S** saves the already displayed canvas.

`path-marks.js` keeps composition constants in `createPathMarks()` and generates commands
lazily in `pathMarkCommands()`. Change `pathMark()` to make another treatment of the
endpoint and incoming heading. The example can show converging paths, canvas exits, and
long horizontal runs; it does not reproduce its motivating sketches' simplex fields,
closure, modulation, triangulation, or branches.

Motivation and acceptance limits are recorded in
`design/capabilities/cp2-public-example.md`. This starter is not a browser-native
conformance or reproduction claim.

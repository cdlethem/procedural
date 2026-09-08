# Cut branch marks in the browser

This source-checkout starter retains one public attempt-bounded branching line pool
grown by repeatedly cutting a selected existing segment, then draws every retained cut
as a capped line segment. It uses the versioned internal p5 Canvas2D frame adapter
already used by the browser Path/Band marks starters.

Serve this directory together with `packages/javascript/src/` and pinned p5 2.3.2, mapping
the p5 script to `/p5.js`. Open `index.html`, then use the visible controls or keys:

- **C** cycles the stroke colour without rebuilding.
- **A** switches the first-cut angle scale between narrow (0.7) and wide (1.4) and
  rebuilds the pool.
- **W** switches the attempt budget between sparse (9,000) and dense (90,000) and
  rebuilds.
- **T** switches the seed stroke between its base and alternate endpoints and rebuilds.
- **R** advances the seed and rebuilds.
- **0** resets to seed 42, wide angle, dense work, the base seed stroke, and the first
  colour.
- **S** saves the already displayed canvas.

`cut-branch-marks.js` keeps composition constants in `createCutBranchMarks()`; all
mutable cutting is performed by the public `seededLinePool2D` operation, matching the
Java example's own `CutBranchComposition` separation (an editable seed-stroke policy
around the retained operation, not a copy of its algorithm).

Motivation and native acceptance for the reference Java composition are recorded in
`catalog/validation/seeded-line-pool-2d.json` (`targets.processing-java.technique`).
This starter is not a browser-native conformance or reproduction claim; it is a scoped
port of that accepted composition's mechanism to p5.js.

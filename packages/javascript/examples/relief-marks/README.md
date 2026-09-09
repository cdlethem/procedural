# Relief marks in the browser

This source-checkout starter structurally recreates Manolo ide's `momito`.
`layout.seeded-quadrant-partition-2d` supplies centre sites for 871 retained
regions at the source's authored settings, and `topology.delaunay-2d` supplies
the canonical face roles. `relief-marks.js` owns the source-specific camera,
height choices, spike dimensions, and an independent `java.util.Random`
stream for the spike-selection policy. It was cross-checked against a real
`ReliefComposition.create(42)` Java run: counts, eight early leaf centres and
spike values, a middle leaf, five early faces, and the final face.

Run the model check:

```sh
node tests/native/relief-marks-model.mjs
```

Run the editable p5.js sketch with its pinned repository-local runtime:

```sh
node tools/serve_relief_marks.mjs
```

Open the reported address. C cycles the relief color; H changes the relief
height; R advances the seed; 0 resets; S saves the displayed canvas without
redrawing.

This is a scoped p5.js WebGL port of the accepted Java composition, not a
browser-native conformance or pixel-reproduction claim. It preserves the
source's three-triangle, non-closed relief face (one slope plus two first-edge
walls). Same-color faces are batched in the adapter; that does not change their
ordered geometry. Renderer lighting, depth precision, and rasterization remain
platform-specific.

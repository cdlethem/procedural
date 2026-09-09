# Landscape marks in the browser

This source-checkout starter structurally recreates Manolo ide's `parapara`.
`field.gradient-noise-2d-01` shapes the three-layer horizon;
`sampling.ordered-circle-filter-2d` accepts a bounded stream of authored
circle proposals; `topology.delaunay-2d` triangulates their retained centres;
and `color.cyclic-palette` supplies the stripe interpolation. The landscape
policy (Java-compatible random draws, palette indices, stripe starts/drifts,
ring and speck settings) is authored in `landscape-marks.js` and was
cross-checked against a real `LandscapeComposition.create(42)` Java run:
horizon and all three layers, four stripe pairs, five early placements and
faces, two noise probes, and values deep in every sequence.

Run the model check:

```sh
node tests/native/landscape-marks-model.mjs
```

Run the editable p5.js example with its pinned repository-local runtime:

```sh
node tools/serve_landscape_marks.mjs
```

Open the shown address. C shifts the palette; P toggles eased versus uniform
stripe spacing; R advances the seed; 0 resets; S saves the displayed canvas
without triggering a redraw.

This starter is a scoped p5.js P2D port of the accepted Java composition, not
a browser-native conformance or pixel-reproduction claim. The source draws
continuous per-vertex alpha stripe and ring gradients; p5.js P2D renders those
same retained geometry and color/alpha endpoints, subject to its canvas
rasterizer.

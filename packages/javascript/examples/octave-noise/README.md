# Octave gradient noise

Serve the study from the repository root:

```sh
node tools/serve_survey_coverage_studies.mjs
```

Open the local `packages/javascript/examples/octave-noise/index.html` study when its example files are present. Edit `sketch.js` directly to change points, dimension, seed, octave schedule, normalization, and the explicit work budget.

The operation returns deterministic scalar values and an amplitude sum. It does not draw, choose a palette, displace points, or substitute host noise implementations.

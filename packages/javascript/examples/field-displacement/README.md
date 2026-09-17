# Field displacement

Serve the study from the repository root:

```sh
node tools/serve_survey_coverage_studies.mjs
```

Open the printed local URL for `packages/javascript/examples/field-displacement/index.html`.
Use `T` to change displacement strength, `M` to switch Cartesian/polar interpretation, `C` to switch lines/dots, `0` to reset, and `S` to save a PNG. Edit `sketch.js` directly to change retained curves, sampled values, noise coordinates, bias, or gain.

The operation transforms supplied point and sample arrays. It does not evaluate a field, choose a path, or provide renderer styling.

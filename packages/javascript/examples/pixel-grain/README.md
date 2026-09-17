# Pixel grain

Serve the study from the repository root:

```sh
node tools/serve_survey_coverage_studies.mjs
```

Open the printed local URL for `packages/javascript/examples/pixel-grain/index.html`.
Use `T` or the Brightness high field to change shared RGB addition, `M` to switch to the isolated alpha layer, `0` to reset, and `S` to save a PNG. Edit `sketch.js` directly to change the source pixels, grid, range, exponent, or explicit seed.

The operation is a detached, seeded ARGB8 pixel transform. It does not reproduce coordinate-hashed shaders, premultiplied canvas behavior, or an entire source sketch.

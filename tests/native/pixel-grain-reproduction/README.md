# Seeded dot blocks

This reproduction keeps the surveyed `2014/Generativos/cuadraditos` cell layout and applies
the public pixel-grain operation. The source layout uses a private, explicit Java RNG replay;
the grain keeps the library's portable stream. Both use seed 42 independently.

Run `node tools/serve_survey_coverage_studies.mjs`, then open
`http://127.0.0.1:8789/tests/native/pixel-grain-reproduction/index.html`.
Use **T** to increase grain, **0** to reset and **S** to save. Edit `sketch.js` for colors,
rectangle sizes and grain settings; `layout.mjs` holds the source layout policy.

`node tests/native/pixel-grain-layout.mjs --output .work/<fresh-report>.json` compares every ordered point with a real Java
RNG oracle. Native automation must run through the shared lease:

```sh
python3 tools/with_native_render_lock.py -- node tools/run_survey_coverage_studies.mjs .work/<fresh-directory> pixel-grain-reproduction
```

The [review](../../../evidence/reproductions/survey-coverage-batch1/grain-replay/root-review.json)
preserves the previous failed candidate and explains the corrected geometry. This is a
selected structural recreation, not exact Processing pixel or grain-stream replay.

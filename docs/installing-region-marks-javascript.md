# Install RegionMarks for p5.js

Build the local JavaScript0.4 package and browser starter in a prepared checkout:

```sh
node tools/build_region_marks_javascript.mjs --output .work/dist/cp4/javascript-region2
```

Use a fresh output directory. Extract `procedurals-region-marks-browser-0.4.0.zip`,
enter its directory, run `npm ci`, then `npm start` and open the printed localhost URL.
The lockfile pins p5 to2.3.2 and the Procedurals dependency to the bundled local tarball.
Dependency installation requires npm access or an existing cache. No registry publication
is needed. Notices are included; node_modules and rendered images are excluded.

Edit `region-marks.js` to supply cells and `sketch.js` to change the content drawn inside.
R changes the seed, N the split count, G the selection fraction, X seeded/authored cells,
M single/grid marks, C the palette and S saves the current canvas. R/N/G are ignored for
authored cells; M/C retain the layout. These are starter choices, not parameter ranges.

The package exposes seven operations, including `seededQuadrantPartition2D`, through
`@procedurals/javascript`. The [packaging report](../evidence/distribution/cp4-javascript.json)
records installation from both the tarball and extracted starter plus five composition
checks. The [native review](../evidence/conformance/quadrant-p5js-root-review.json) separately
covers the reviewed browser workflow; this packaging build performs no new native render.

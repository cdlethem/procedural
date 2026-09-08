# Install GrainMarks for p5.js

Build the local JavaScript 0.5 package and browser starter:

```sh
node tools/build_grain_marks_javascript.mjs --output .work/dist/cp5/javascript-grain1
```

Extract the generated `procedurals-grain-marks-browser-0.5.0.zip`, run `npm ci`, then
run `npm start` and open the printed localhost URL. The starter installs the adjacent
local package and pins p5 to 2.3.2. The package includes the triangle sampling and
quadrant operations used by the editable GrainMarks composition.

Edit `grain-marks.js` to change the triangle, density, distribution, or cell transfer;
edit `sketch.js` to change the marks and palette. The build checks installation and six
representative composition configurations but performs no browser render or support
acceptance.

Use R for seed, N for density, B for concentration, X for cell transfer, M for motif,
C for palette, 0 to reset, and S to save the displayed image. Motif/palette edits retain
geometry. These are example controls, not library parameter defaults.

The [package review](../evidence/distribution/cp5-javascript-review.json) covers installed
consumers and archive source identity. The [native review](../evidence/conformance/triangle-p5js-native-root-review.json)
covers the browser workflow and explicit dot motif. Python package integration remains
pending; no registry publication is claimed.

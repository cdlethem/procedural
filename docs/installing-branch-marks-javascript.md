# Install BranchMarks for p5.js

In a prepared checkout, build a fresh local package:

```sh
node tools/build_branch_marks_javascript.mjs --output .work/dist/cp6/javascript-branch1
```

Extract `procedurals-branch-marks-browser-0.6.0.zip`, enter its starter folder, run
`npm install`, then `npm start`. Open the printed local URL. The ZIP carries the local
0.6.0 package tarball; p5.js2.3.2 is installed through its pinned dependency.

R changes seed; N toggles an extra generation; G narrows; W widens; B changes slots;
X places a forest. M changes taper/tips and C changes palette while retaining geometry.
0 resets and S saves the displayed canvas. Edit `branch-marks.js` to change the rule
schedule or root placement, and `sketch.js` for drawing treatment. These are example choices.

The package exports ten operations, including `seededEndpointBranches2D` and its
`BranchTreeError`. The [package review](../evidence/distribution/cp6-javascript-review.json)
covers installed/extracted consumers; the [native review](../evidence/conformance/branch-p5js-native-root-review.json)
covers17 editing states. This is a local distribution, not a registry release.

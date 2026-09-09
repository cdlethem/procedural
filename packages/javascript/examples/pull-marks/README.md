# Pull marks in the browser

This source-checkout starter deforms a straight scanline grid or three retained
closed-spline contours through two radial pull influences (`geometry.radial-pull-2d`),
sharing one transform across both draw modes. Cross-checked the grid/contour
transform outputs against a real `RadialPull2D` + `ClosedSpline2D` Java reference
run before writing the JS model test (byte-identical first grid and contour points).

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted PullMarks composition's mechanism to p5.js.

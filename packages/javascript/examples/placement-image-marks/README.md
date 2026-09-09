# Placement image marks in the browser

This source-checkout starter scales one authored source panel (optionally
cropped) into a fixed frame under one of three fit modes (CONTAIN, COVER,
STRETCH), aligns it within the frame, and composites it over a grid ground
- everywhere, or through an elliptical alpha mask - using
`raster.masked-source-over-2d`. The crop-extraction and fit/align rectangle
math mirrors Java's `Java2DImagePlacement.render` (a JAVA2D-only Processing
adapter, not a portable catalog operation) and is checked in the JS model
test against hand-computed expected values for all three fit modes, both
crop states, and every alignment extreme, transcribed directly from the
Java source's scale/alignment arithmetic.

F cycles the fit mode, C toggles the crop, A cycles alignment, M toggles the
mask, and S saves without redraw. The Java source is marked a candidate
example; the operation it demonstrates is accepted.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the PlacementImageMarks composition's mechanism to
p5.js.

# Path clip marks in p5.js

This standalone example composes editable source paths with
`geometry.clip-segments-simple-polygon-2d`. Choose straight rows, seeded wander or
a fan, then independently position and reshape a rectangle, bottom portal, right
bay or regular polygon. The controls expose path density, source variation,
boundary geometry, line weight and optional boundary outline. Reset restores the
defaults, reload restores the page, and PNG export retains transparent space.

`path-clip-quality.js` holds this example's source layout, boundary construction
and explicit combined-work preflight. The portable clipping computation remains in
`src/segment-clip.js`. The historical six-trace Java comparison model remains in
`path-clip-marks.js`, with its focused test unchanged; it is separate from this
new editable composition.

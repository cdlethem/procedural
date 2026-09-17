# Projection marks

The standalone p5 page composes 96-sample source paths as rows, columns or
spokes, then applies `sequentialDiscProjection2D` to every sample. Choose 4–80
paths and one or two ordered discs. Each disc has an editable center and radius;
global projection strength, source jitter, stroke weight, seed and palette are
separate choices. Reset restores the authored starting composition. Save PNG
exports transparent space around marks.

The page uses the private `deformation-marks-studies.js` draw adapter and shared
`deformation-marks-controls.js` form. Its 640-pixel coordinates and seed schedule
match the modern Studio study. Path count × 96 samples × active discs is bounded
to 16,000 before drawing. The earlier `projection-marks.js` composition remains
in the package as historical source for its four-disc contour/scanline study and
Java cross-check; the new page does not claim that old composition has the same
image. The portable operation remains in `src/disc-projection.js`.

Projection applies discs in order. A later disc can move a sample after an
earlier disc has acted, so this is deformation rather than collision resolution.

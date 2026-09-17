# Pull marks

The standalone p5 page composes 96-sample source paths as rows, columns or spokes,
then applies `radialPull2D` to every sample. Choose 4–80 paths and one or two
independent pulls. Each pull has an editable center, radius and falloff power;
source jitter, stroke weight, seed and palette are separate choices. Reset restores
the authored starting composition. Save PNG exports transparent space around marks.

The page uses the private `deformation-marks-studies.js` draw adapter and shared
`deformation-marks-controls.js` form. Its 640-pixel coordinates and seed schedule
match the modern Studio study. Path count × 96 samples × active influences is
bounded to 16,000 before drawing. The earlier `pull-marks.js` composition remains
in the package as historical source for its grid/closed-spline transfer and Java
cross-check; the new page does not claim that old composition has the same image.
The portable operation remains in `src/radial-pull.js`.

Radial pulling may fold a line near a center. It is a deformation, not an inverse
mapping or a guarantee against self-intersection.

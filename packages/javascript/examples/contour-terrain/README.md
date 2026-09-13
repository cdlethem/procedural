# Contour terrain

Layered colored contour strokes make a seeded noise field read as a compact topographic drawing. Serve this directory from the project’s p5 example server, which provides `/p5.js`, then open `index.html`. Edit `../cell-mosaic/expansion-studies.js` to change the sampled field, contour treatment, or palette.

| Control | Canvas effect |
|---|---|
| T | Adds contour levels. |
| C | Changes the contour palette. |
| 0 | Restores the initial composition. |
| S | Saves the current canvas as PNG. |

Uses `field.gradient-noise-2d-01` and `geometry.marching-squares-2d`. This independent design is admitted in `design/capabilities/p5-gallery-expansion.md`.

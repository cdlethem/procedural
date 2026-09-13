# Faceted silhouettes

An original editable p5 design study. Serve the examples so `/p5.js` is available, then open `index.html`.

Edit `../paths-a-studies.js` to change the composition; `sketch.js` wires the shared drawing function into the study controls.

| Control | Effect |
| --- | --- |
| T | Applies the study's structural edit. |
| C | Changes the packed RGB palette. |
| 0 | Restores baseline parameters and palette. |
| S | Saves the current canvas as PNG. |

The drawing calls [geometry.triangulate-simple-polygon-2d](../../../catalog/operations/triangulate-simple-polygon-2d.json) through `triangulateSimplePolygon2D`. This README describes an editable example only; it makes no native-support claim.

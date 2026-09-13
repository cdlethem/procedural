# Rounded polyhedra

This study projects computed 3D triangle faces onto the canvas with a fixed tilted camera. Faces sort by camera depth before drawing, so changing the structural control changes solid form rather than a surface filter.

| Control | Canvas effect |
| --- | --- |
| First control | Changes mesh height, refinement, or path sampling. |
| Second control | Changes the camera angle or ribbon width. |
| Third control | Changes edge weight or camera angle, matching the study controls. |
| Palette | Recolors depth-sorted faces. |
| Reset | Restores the baseline mesh input. |

Supply a different valid polygon, path, or manifold triangle mesh to replace the generated source while retaining the projection recipe.

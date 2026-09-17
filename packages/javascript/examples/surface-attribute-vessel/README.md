# Surface attribute vessel

A lit WebGL vessel shows smooth side normals, a separate top-cap group, and an intentional UV seam. The four-field source image has different colors and letters at every corner, so its orientation is easy to inspect. A second supplied mesh transfers the same attribute operation to a ribbon.

| Control | Canvas effect |
| --- | --- |
| G | Changes the vessel profile while retaining the image. |
| N | Switches equal-weight smooth normals and per-face flat normals. |
| U | Replaces the asymmetric source image while retaining geometry. |
| T | Uses independently authored ribbon positions, triangles, and UV corners. |
| 0 | Restores the initial study. |
| S | Saves the displayed PNG. |

The study imports `prepareSurfaceAttributes3D` from `../../src/prepare-surface-attributes-3d.js` and makes a private p5 Geometry from detached output. The public operation does not choose the camera, texture, light, or UV chart. This example requires WebGL; after a WebGL context loss, reload the page to restore it.

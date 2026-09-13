# Contour terrain

Trace colored height lines through a sampled noise field. Several thresholds reveal hills, valleys and narrow passages as an open drawing of contour strokes.

Adjust **Terrain scale** to change feature size, then increase **Grid samples** if finer bends need more detail. The field stays fixed when changing grid resolution; the contour approximation becomes finer.

| Control | Canvas effect |
|---|---|
| Contour levels | Adds thresholds within the same scalar interval. |
| Terrain scale | Larger values make smaller, more frequent terrain features. |
| Grid samples | Refines the square sample grid. |
| Line weight | Thickens all contour strokes. |
| Index lines | Emphasizes every fourth threshold. |
| Seed | Chooses a different repeatable noise field. |
| Palette | Colors successive height levels without changing geometry. |

The sketch samples [Gradient noise](../catalog/operations/gradient-noise-2d-01.json), then calls [Marching squares](../catalog/operations/marching-squares-2d.json) once per threshold. Returned strokes are drawn directly; contours are not joined into closed paths or filled regions. The transparent drawing can sit over another Studio layer.

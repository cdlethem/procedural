# Faceted silhouettes

Turn a straight-sided silhouette into colored triangular paper planes, with optional
facet edges and grain marks. This page starts from a convex boundary; the
[Concave grain](/techniques/concave-grain) page starts from a notched one. Both expose
the same boundary and faceting controls, so you can switch between them here.

| Control | Canvas effect |
| --- | --- |
| Boundary | Choose convex or radially notched source geometry. |
| Outer sides | Set the number of outer corners. A notched boundary adds one inner corner between each outer pair. |
| Notch radius | Move inner corners toward the center or outer edge when the boundary is notched. |
| Boundary radius / Height ratio / Rotation | Size, stretch and turn the polygon before triangulation. |
| Facet fill / Show facet edges | Set triangle fill opacity and show or hide their outlines. |
| Stroke weight | Change facet-edge and fan-line width. Zero removes those lines. |
| Grain treatment / Grain marks | Draw fan lines, dots, or no grain; set marks per triangle. |
| Grain opacity | Fade the facet-local grain independently of the fill. |
| Palette | Recolors the same triangulated geometry. |

The editable source is a simple polygon. `geometry.triangulate-simple-polygon-2d`
returns straight triangles, then p5 paints each facet; it does not model a curved
surface. You can supply a different valid simple polygon in code. A collinear notch
configuration is rejected before triangulation. The layer has
no opaque page fill. Exact values can extend beyond slider intervals where valid;
combined polygon and grain work remains bounded.

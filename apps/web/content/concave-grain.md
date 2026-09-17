# Concave grain

Break a silhouette with inward corners, then colour its straight triangular facets and
add fan lines or dots within each one. This page starts with a notched boundary;
[Faceted silhouettes](/techniques/faceted-silhouettes) starts convex. The pages are paired
examples of the same editable faceting mechanism.

| Control | Canvas effect |
| --- | --- |
| Boundary | Switch between radially notched and convex source geometry. |
| Outer sides | Set the number of outer corners; notched mode adds one inner corner between each pair. |
| Notch radius | Set how deeply inner corners pull toward the center in notched mode. |
| Boundary radius / Height ratio / Rotation | Size, stretch and turn the source polygon. |
| Facet fill / Show facet edges | Set triangle fill opacity and show or hide triangle boundaries. |
| Stroke weight | Change facet-edge and fan-line width. Zero removes those lines. |
| Grain treatment / Grain marks | Choose fan lines, dots, or none, and how many marks each triangle receives. |
| Grain opacity | Fade the grain without changing the facet fill. |
| Palette | Recolors the same facets and marks. |

`geometry.triangulate-simple-polygon-2d` divides the supplied simple polygon into
straight triangles. The filled facets and grain are p5 drawing choices, not a curved
surface. Replace the polygon source in code to use another valid outline; crossing or
collinear notches can be rejected by the strict triangulation contract. The layer stays
transparent for stacking. Exact entry may exceed the slider interval where valid, and
a combined polygon/grain budget bounds generation.

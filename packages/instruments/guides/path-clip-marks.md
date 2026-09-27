# Clip an editable family of paths

Start with straight rows, seeded wandering paths or a left-hand fan; clip their segments against a separate simple boundary. Clipping removes parts outside the region, rather than steering the original path. Keep the boundary outline off for isolated transparent fragments, or show it to inspect the geometry you are cutting against.

| Control | Canvas effect |
| --- | --- |
| Source paths / Paths / Segments per path | Choose the path family, count and detail before clipping. |
| Wander | Seeded vertical variation in Wander mode; Rows and Fan ignore it. |
| Clip boundary | Choose a rectangle, bottom portal, right bay or regular polygon. |
| Boundary center / width / height | Move and resize the boundary independently of the source paths. |
| Notch opening / depth | Open a portal or bay into one side; zero depth or opening restores a rectangle. |
| Polygon sides / angle | Change corner count and orientation in Regular mode. |
| Stroke weight / Show boundary | Change marks and optional boundary overlay without altering the source paths. |

Try Wander with a broad portal opening to break a field of paths into separate retained areas. Shrink Boundary width to retain only a few central fragments; turn off Show boundary and layer those over another drawing. For a different construction, switch to Fan and use a rotated regular polygon. The released segment-to-simple-polygon clipper works on the actual path segments; the selected source family and optional outline are instrument-specific drawing choices.

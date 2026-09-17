# Road margins

Draw parallel edges beside one or more winding open routes. The source routes are
waypoint polylines: you can change their bends, spacing and smoothing before offsetting
them, then show either margin, both margins, the centerline, or the original waypoints.

| Control | Canvas effect |
| --- | --- |
| Routes / Route spacing | Set how many centerlines appear and how far apart they start. Negative spacing reverses their vertical order. |
| Turns | Sets the number of waypoint intervals in each source route. |
| Bend amplitude / Bend cycles / Bend phase | Shape the routes' sinusoidal bends: reach, oscillations across the canvas, and starting angle. Negative cycles reverse progression. |
| Route smoothing | Applies Chaikin passes to each open waypoint path before offsetting. Zero keeps the straight segments. |
| Signed margin | Moves an edge to one side of its refined route. Its sign chooses the side when showing one edge. |
| Both sides | Adds the opposite signed edge at the same margin distance. |
| Join limit | Limits pointed offset joins before they bevel. |
| Show centerlines / Show margin edges / Show waypoints | Independently reveal the refined route, its offset edges, and original source nodes. |
| Stroke weight | Changes line width. Zero hides lines while waypoints may remain visible. |
| Palette | Recolors the same paths. |

The supplied source is an editable open route; `geometry.chaikin-polyline-2d` refines it
and `geometry.offset-polyline-2d` calculates the edge polylines. You can replace the
source waypoints in code with another route. An offset edge is a path, not a filled road
or a Boolean cleanup of crossings. The layer remains transparent for composition.
Exact numeric entry can go outside the slider's convenient span where valid; a combined
route, turn and smoothing budget bounds the work.

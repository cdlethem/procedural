# Grow claimed lattice routes

Columns and Rows set the actual dimensions sent to `occupiedLatticePaths2D`. Cell spacing X/Y, Source X/Y and Source rotation map those retained cells into canvas space without resampling occupancy. Paths supplies ordered starting cells; Start layout chooses seeded scattered, spaced or concentrated center starts. Moves is an upper limit on cardinal movement, **not** a guaranteed length. An occupied starting cell produces an empty route; a blocked route ends when all neighbors have already been claimed. Paths compete in request order, so adding later starts does not steal earlier routes. A new seed changes starting sites in Scatter/Center and the random walk decisions.

| Controls | What changes on the canvas |
| --- | --- |
| Columns, Rows | Set the occupied grid's actual cell count; each route can claim a cell only once. |
| Cell spacing X/Y, Source X/Y, Source rotation | Space and position the existing cell routes on the canvas without changing which cells were claimed. |
| Paths, Start layout, Moves, seed | Choose ordered starts and how far each route may walk. Blocked or occupied starts do not gain replacement routes. |
| Dots, Stroke width, Dot size | Switch lines to cell dots and set their painted size without rerouting. Stroke width affects lines; Dot size also affects endpoints. |
| Grid, Endpoints, Shadow, palette | Independently show lattice guides, claimed route ends or an offset shadow, and recolor the route order without changing occupancy. |

Routes are lines or cell dots. Stroke width controls line material and Dot size sets the cell or optional endpoint size. Grid, Endpoints and Shadow are separate construction guides, all initially off: a route remains usable as an isolated fragment without a background panel. Colors follow route order. Grid maps the actual edited cell dimensions.

- Small fragment: columns 12, rows 8, spacing X 15 and Y 17, center (145, 540), 3 paths, 9 moves, Scatter, thin route lines.
- Loose cluster: columns 18, rows 13, center (360, 330), 24 paths, 7 moves, Center, Dots at diameter 5.
- Dense network: columns 32, rows 22, spacing X 16 and Y 20, 45 paths, 35 moves, Spaced, Shadow off and Endpoints on.

When a route ends early or does not start, no replacement route is fabricated. Zero starts or zero line weight with all overlays off can leave the layer empty. Source rotation affects placement on the canvas but not which cells claim one another. Avoid expecting gaps between adjacent routes: occupancy guarantees unique **cells**, not minimum stroke clearance.

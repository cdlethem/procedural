# Curved trajectories

Follow starts arranged on a ring through a field assembled from uniform drift and independent signed radial and rotational velocity sources. This preset emphasizes centerlines and regularly spaced station dots rather than wide ribbons; it uses exactly the same editable Flow Traces instrument as Stream ribbons, not the potential-derived curl field used by Swirling particles. The paths are real RK4 trajectories sampled from the vector grid.

| Control | What to change |
| --- | --- |
| Vector source arrangement, count, center, extent, aspect, angle | Arrange up to 32 source centers in a line, ring, area or grid; the preset uses four around a ring. Source placement does not determine the trajectory starting positions. |
| Source disorder, Seed | Move source centers by a bounded seeded jitter. With zero source and start disorder, reseeding leaves geometry unchanged. |
| Influence radius, Rotational velocity, Radial velocity | Set Gaussian source reach, signed tangential spin and signed outward flow. Negative radial velocity draws paths inward; rotation can operate with or without attraction. |
| Horizontal/Vertical drift | Add a straight velocity anywhere in the field, including with zero vector sources. |
| Vector grid samples, Field center, Field extent | Choose sampling density and the square integration domain. Trajectories stop at its edge rather than being moved to fit the canvas. Tight influence radii need correspondingly denser samples. |
| Trace start arrangement, count, center, extent, aspect, angle, disorder | Switch between a ring, line, filled area and grid independently of the source arrangement. The preset starts on a lightly disordered elliptical ring; start disorder does not change the grid vectors. |
| Integration steps and time step | Decide how long RK4 integrates and how far a path travels per step. Zero time step produces no length. |
| Centerlines, Filled ribbons, Stations | Enable line strokes, actual offset strips and equally arc-spaced stations independently. Line weight, ribbon width, station diameter and approximate station stride are material controls only. |

For **orbital fragments**, use ring sources, radius 130, rotation 18, radial −8, start ring extent 350, 72 steps and stations on. For **attracting spokes**, use one source at (320, 320), radius 260, radial −14, rotation 0, no drift and 20 ring starts; shorten to 35 steps and enable ribbons to keep the paths distinct. For **crosswind arcs**, use two line sources, radius 180, rotation −12, radial 5, drift (8, 1), and 15 starts in a narrow vertical line; try line-only, then replace it with station-only material.

The released RK4 tracer charges a copy of the grid plus 17 units per requested step and trace: `startCount × (gridColumns² + 17 × steps + 1)` must remain at most 1,000,000, with at most 30,000 requested segments. Each trace may terminate early at the field edge. Material and palette edits retain the same source trajectories, and seed matters only with positive source or start disorder.

# Stream ribbons

Paint filled strips beside genuine RK4 trajectories through a sampled vector grid. The field is the sum of uniform drift and independent signed radial and rotational influences around a population of source centers. Unlike Swirling particles, this is not a scalar-potential curl: attraction or repulsion and straight through-flow can coexist. Trace starts are a separate population; moving the starts does not move the vector sources.

| Control | What to change |
| --- | --- |
| Vector source arrangement, count, center, extent, aspect, angle | Arrange zero to 32 local vector centers along a line, ring, filled area or grid, anywhere on or off the page. Zero centers leaves only drift. |
| Source disorder, Seed | Introduce seeded displacement to vector source centers. Zero disorder gives the same centers for every seed. |
| Influence radius, Rotational velocity, Radial velocity | Radius sets each center's Gaussian spatial falloff. Positive rotation turns clockwise on screen (positive Y points down); positive radial moves outward and negative radial attracts. Zero both components to isolate drift. |
| Horizontal/Vertical drift | Set the independent uniform velocity components, in canvas units per integration time. |
| Vector grid samples, Field center, Field extent | Set the square domain on which velocities are sampled. The RK4 integrator interpolates this grid and stops when a step reaches its boundary; zooming the field changes sampling resolution, not source positions. Increase samples when the influence radius becomes narrow relative to grid spacing. |
| Trace start arrangement, count, center, extent, aspect, angle, disorder | Place starts independently as line, ring, filled area or grid. Start disorder changes only the starts, not the field. Zero extent can deliberately superimpose starts. |
| Integration steps, Integration time step | Change trajectory length and travel rate, not line weight. A zero time step leaves all traces at their starting points. |
| Centerlines, Filled ribbons, Stations | Switch three separate materials on or off. Line weight, full ribbon width and station diameter never alter the underlying trajectories. Stations are spaced uniformly by traveled distance; station stride chooses their approximate number. Palette recolors without retracing. |

Try **ordered cross-flow** with 3 sources on a line, source disorder 0, radius 165, rotation 15, radial −4, drift (4, −1.5), and 18 line starts. Try **inward estuary** with 2 ring sources, radius 220, rotation −5, radial −14, drift (7, 1), 12 grid starts, ribbons off and stations on. Try **small local ribbon patch** with field center (430, 200), extent 230, source center (430, 200), source extent 80, and 8 starts near (385, 210); paths stop at the edge instead of secretly fitting the artwork to the canvas.

The renderer traces each path through the released RK4 grid operation. A trace copies the sampled grid and charges `gridColumns² + 17 × steps + 1` work units; all traces together permit at most 1,000,000 such units and 30,000 requested trace segments. Streams that reach the field edge may end earlier. Material controls reuse one cached source construction. Seed matters only when source or start disorder is positive.

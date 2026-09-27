# Band marks

Draw meandering paths, isolated nodes or short transverse ticks from independently placed starts.

Each start traces a separate `noiseBandPath2D` path against seeded gradient noise. A path begins with one retained start vertex. **Attempts per path** counts proposals, not successful steps: only proposals strictly within **Band tolerance** of the *starting* noise value append a vertex and advance the position. Rejected proposals change the heading but not the position. Consequently a low tolerance can leave isolated starting nodes even after hundreds of attempts; increasing the attempt count does not promise a longer path. The source is bounded to 60,000 aggregate potential vertices/attempts (`count × (attempts + 1)`).

| Controls | Effect |
| --- | --- |
| Start count, Start layout, Grid columns | Place starts along a line, evenly in a grid, randomly in an area, or around a ring. Grid columns only affects the grid. |
| Center X/Y, Extent, Aspect | Set the arrangement's canvas-space center, horizontal span and vertical/horizontal span ratio. No source auto-fit occurs. |
| Heading, Heading spread, seed | Set the initial direction and seeded deviation. The seed also governs proposal turns and the noise field. |
| Attempts per path, Step distance | Change the proposal count and canvas-space step distance; zero attempts retains just the start. |
| Field frequency, Field offset X/Y, Band tolerance | Sample a shifted noise field and test each proposed position against the fixed starting scalar level. Zero frequency makes the field spatially constant. |
| Path strokes, Retained marks, Mark stride | Independently connect accepted vertices and optionally paint retained nodes or ticks at every nth retained step. Tick directions come from accepted headings; neither treatment marks rejected proposals. |
| Stroke weight, Tick length, Node size, palette | Style paths and marks without changing source geometry. A zero size or disabled strokes can make a source invisible. |

For a tight meandering strip, try **Start layout** line, **Start count** 8, **Extent** 240, **Center Y** 320, **Attempts** 700, **Tolerance** .005, **Step distance** 1.7, **Path strokes** on and **Retained marks** none. Contrast this with a sparse survey: **Start layout** ring, **Start count** 18, **Extent** 320, **Aspect** .65, **Tolerance** .001, **Retained marks** nodes, **Node size** 3 and **Path strokes** off; short traces and isolated starts are intentional outcomes. For perpendicular hatching use a grid, **Retained marks** ticks, **Mark stride** 3, **Tick length** 10, and disable **Path strokes**. Retained ticks and path strokes can also coexist.

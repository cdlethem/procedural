# Branch marks

Grow sparse forks, small trees or loose groves with editable root placement and generation-by-generation branching.

`seededEndpointBranches2D` grows a breadth-first retained segment tree from each editable root. Generation 0 is the root segment. For each existing segment in each requested generation, the core independently tests each child slot against **Child survival**; a failed slot has no segment and therefore no descendants. Existing parent segments are never erased by pruning. Zero survival leaves exactly the root segment per tree. A zero-generation tree also has only its root, regardless of child settings.

| Controls | Effect |
| --- | --- |
| Roots, Root layout, Grid columns | Arrange one or more roots in a line, grid, seeded area or ring. Grid columns affects only the grid. |
| Center X/Y, Extent, Aspect | Set the local arrangement's canvas position, horizontal span and vertical/horizontal ratio; there is no compulsory trunk at the old fixed location. |
| Root heading, Root spread, Root length | Choose direction in degrees (−90 points up), seeded directional variation and initial canvas-unit segment length. |
| Generations, Child slots | Grow zero to nine generations beyond each root, with two or three independent potential child slots per parent. |
| Branch angle, Turn spread, Length contraction | Set symmetric turns around the parent, seeded turn range around each slot center and child/parent length ratio. Three slots have a center turn; two have only left/right slots. |
| Child survival, seed | Per-slot independent survival and reproducible root arrangement, angle choices and branch lengths. Lower probability does not impose a fixed output count. |
| Branch strokes, Base weight, Tip size, palette | Paint tapered retained branches and/or dots on actual leaves (segments with no surviving children). Tip size zero removes dots. |

Try a lone fan: **Roots** 1, **Root heading** −90, **Root length** 90, **Generations** 5, **Child slots** 3, **Branch angle** 32, **Turn spread** 12, **Length contraction** .7, **Child survival** .8. Contrast with a spaced hedge: **Roots** 6, **Root layout** line, **Extent** 460, **Center Y** 510, **Generations** 4, **Child slots** 2, **Branch angle** 43, **Child survival** .55, **Tip size** 2. For isolated potential roots with only terminal dots set **Generations** 0 and turn **Branch strokes** off. The 12,000-segment worst-case limit is checked from roots, child slots and generations before generating a tree, independently of survival probability; reduce one of those controls if the arrangement is rejected.

# Contour relief

Build a folded height-surface fragment with level curves on its faces, or leave only the suspended contour lines.

A sampled scalar field becomes a local WEBGL surface of ordinary grid triangles and/or horizontal level curves cut through **those same triangles**. The two planar triangles in each cell meet along a diagonal; their contour segments meet on that diagonal, even when the four corner heights are nonplanar. Contour values refer to the **original source heights**, before Height scale; negative Height scale flips the elevations. The mesh, edges and curves can each be switched off. This is not an oblique slice, a terrain erosion simulation, or a fabrication-ready mesh. Flat Contour terrain and Contour blobs instead use the released `marchingSquares2D` operation on the shared scalar field.

To enter or resize a numeric grid, keep a procedural source selected while setting dimensions and text, then choose Numeric grid last. A partially resized grid is rejected rather than silently repaired.

| Controls | What changes |
| --- | --- |
| Height source | Hills use seeded soft hill placement; Noise uses seeded gradient noise; Waves and Saddle are deterministic signed functions; Numeric grid uses precisely the entered samples. Seed does not affect Waves, Saddle or Numeric grid. |
| Grid columns, Grid rows | Independent sample counts including endpoints, not the number of triangles. Rectangular, non-square domains work. |
| Numeric height grid | Exactly Rows nonblank lines, each with exactly Columns whitespace-separated finite numbers within [-16,16]. No header, implicit resizing, missing-value fill or discarded rows. Set grid dimensions to match your edited text. |
| Frequency, Source aspect, Wave phase | Wave frequency, relative Y-axis wave/noise frequency, and phase in degrees. For hills, Frequency shifts seeded hill placement, Source aspect reshapes the soft hills; phase has no effect. |
| Hills, Hill radius | Number and relative reach of seeded hills. Only active for Hills source. |
| Surface width, Surface depth | Physical footprint in canvas units, independent of grid resolution. No automatic canvas fit. |
| Height scale | Signed elevation per scalar unit in canvas units; positive source heights rise toward the unrotated camera (+Z), negative values invert them. Zero flattens surface and contour elevations but leaves their XY paths. |
| Center X/Y, Yaw/Pitch/Roll | Rigid position and viewing rotation, independent of source generation. Center 320/320 aligns with the center of a 640×640 WEBGL canvas. Angles are in degrees. |
| Contour levels, Level values, Level count/base/step | List mode accepts 1–32 strictly ascending finite source values within [-16,16], delimited by commas or whitespace. Sequence mode uses `base + i × step` for 0 ≤ i < count, with positive step; values must remain within [-16,16]. |
| Surface faces, Grid edges, Contour lines | Independent ink switches; all three off means empty output. Edges follow actual sampled grid links. Contour lines intersect each planar surface triangle at their horizontal source-height levels; they are not bilinear marching-squares paths draped above a different mesh. Plateau triangles and isolated level-equal vertices add no fictitious strokes. |
| Face coloring, Edge weight, Contour weight | Palette bands reflect source height or physical slope, while weights affect only their respective lines. Weight zero omits its ink. When faces are shown, contours receive a **0.6 canvas-unit display lift toward the camera before rotation**, reducing coincident-depth flicker while retaining occlusion from other surface folds. The actual intersections, source heights and measured levels remain unchanged. |

**Compact hill contours:** Source Hills; Columns/Rows 39/39; Hills 2; Hill radius .15; Width/Depth 260/230; Height scale 90; Faces off; Edges off; Contours on; List levels `.15, .3, .5, .7`; Pitch 50. A small separated cluster of levels remains freely movable through Center X/Y.

**Signed saddle and waves:** Source Saddle; Columns/Rows 55/43; Frequency 2.2; Source aspect .8; Phase 35; Width/Depth 460/300; Height scale -90; Faces on; Face coloring Slope; Edges off; Contours on; Sequence count 7, base -.8, step .27. Compare Source Waves at the same levels: there is no seed change and no physical pendulum/water simulation.

**Edited numeric grid:** Source Numeric grid; Columns 5; Rows 5; Level mode List; Level values `.5, 1, 2`; Grid text:

```text
0 0 0 0 0
0 1 2 1 0
0 2 4 2 0
0 1 2 1 0
0 0 0 0 0
```

Set Faces off and Contours on to inspect interpolation. Switch Faces on and Grid edges on to see exactly where the samples lie; try Height scale -45 to invert the relief without changing contour XY geometry. A changed row length is an input error, not a resampling instruction.

Preflight bounds: at most 12,000 grid triangles and 150,000 grid cells × contour levels, plus 32 levels maximum. Each requested level checks both triangles in every cell; edit dimensions or level count if the bounds are exceeded. Field samples and mesh intersection segments are cached independently of material, palette, placement, height scale and view settings; footprint changes retain samples but recompute the segment XY coordinates. The two flat contour views retain separate marching-squares segment extraction and its core work allowance.

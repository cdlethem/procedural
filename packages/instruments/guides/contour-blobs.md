# Contour blobs

Make isolated hill rings, merging islands or rippling loop sequences from an editable field.

Contour blobs is a flat 2D view of the same sampled scalar-field instrument used by Contour terrain and the WEBGL Contour relief. With Hills selected, distinct seeded soft peaks add into a heightfield; horizontal marching-squares thresholds merge and split around those peaks. These are sampled line segments, not fitted closed outlines or a packing algorithm.

To enter or resize a numeric grid, keep a procedural source selected while setting dimensions and text, then choose Numeric grid last. A partially resized grid is rejected rather than silently repaired.

| Control | Effect |
| --- | --- |
| Height source | Hills is the starting recipe; Noise, Waves, Saddle and Numeric grid use the same source engine. Seed affects Hills and Noise only. |
| Hills, Hill radius | Number and normalized XY extent of seeded soft hills. For non-Hills sources neither changes the field. |
| Grid columns/rows, Numeric height grid | Editable rectangular sampling. Numeric grid requires exactly Rows nonblank lines × Columns whitespace-separated finite values [-16,16], with no automatic interpolation or padding. |
| Frequency, Source aspect, Wave phase | Frequency shifts seeded Hills placement, adjusts Noise sampling and controls wave cycles. Aspect stretches hill shape or relative Y frequency. Phase shifts Waves/Saddle only. |
| Surface width/depth, Center X/Y, Orientation | Local 2D footprint, position in 640-unit canvas coordinates and planar rotation in degrees; nothing auto-fits the canvas. |
| First level, Level spacing, Contour levels | Heights `base + index × spacing`, with positive editable scalar spacing and at most 32 ascending thresholds in [-16,16]. Contrast the former fixed .14 step with an actual editable spacing control. |
| Line weight, Index lines, Hill centers | Independent stroke thickness, heavier every-fourth level, and optional small crosses at actual seeded hill locations. Hill centers appear **only** with Hills source; they remain meaningful even with contour weight zero. Palette cycles by level and hill without resampling. |

**Close hill rings:** Source Hills; Hills 3; Hill radius .13; Grid 57×51; Width 300; Depth 270; First level .15; Level spacing .15; Levels 6; Hill centers on. Move Center to 220/290 and rotate Orientation 20; the field and levels stay fixed, while its footprint moves.

**Merging wide hills:** Hills 8; Hill radius .32; Grid 63×55; Width 420; Depth 310; First level .25; Level spacing .2; Levels 7; Hill centers off. Compared with the close-ring recipe, wider peaks join at low levels and may remain separate higher up.

**Manually drawn ridge:** Source Numeric grid; Columns/Rows 5/5; First level .5; Level spacing .5; Levels 4; use the five rows `0 0 1 0 0`, `0 1 2 1 0`, `0 2 3 2 0`, `0 1 2 1 0`, `0 0 1 0 0`, each on its own line. Width 130; Depth 150; Center 480/420. The explicitly entered field ignores seed and Hills count. Switch back to Hills if you want meaningful peak-center crosses.

Source computation and marching-squares extraction are independent of palette, placement, orientation and stroke material. Before allocating a grid the instrument rejects more than 12,000 grid triangles or 150,000 grid cells × contour levels.

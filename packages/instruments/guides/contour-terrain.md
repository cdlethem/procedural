# Contour terrain

Draw flat contour patches from waves, noise, hills or your own height grid, without a filled background.

An editable **local scalar field** yields horizontal marching-squares lines in a 2D transparent layer. Unlike the Contour relief WEBGL surface, this view is flat: it has no surface faces, pitch or lighting. It does not join every segment into a closed path or simulate erosion.

To enter or resize a numeric grid, keep a procedural source selected while setting dimensions and text, then choose Numeric grid last. A partially resized grid is rejected rather than silently repaired.

| Control | Result |
| --- | --- |
| Height source | Seeded Noise or Hills, deterministic Waves/Saddle, or exact Numeric grid samples. Source selection changes the actual sampled heights. |
| Grid columns/rows | Independent sample counts, including domain boundaries. The field is rectangular; a finer grid resolves smaller details but does not change frequency. |
| Numeric height grid | Exactly Rows nonblank lines, exactly Columns whitespace-delimited finite values [-16,16] per line. Change dimensions alongside the text; mismatches are input errors. |
| Frequency, Source aspect, Wave phase | Noise/wave feature spacing and Y-axis ratio; phase shifts only Waves/Saddle. Frequency shifts Hills' seeded placement; Hill radius and Hills affect only the Hills source. |
| Surface width/depth, Center X/Y, Orientation | Independent local footprint and canvas-coordinate placement (320/320 = center of a 640×640 canvas), then planar rotation in degrees. No full-page square, frame or canvas fit is compulsory. |
| First level, Level spacing, Contour levels | Trace `base + index × spacing` in **source-value units**, increasing by a positive editable step; count ≤32 and values must remain in [-16,16]. A level outside the actual field range simply has no segments. |
| Line weight, Index lines, Hill centers | Stroke ink and optional heavier every-fourth level; palette cycles by level without changing extraction. Hill centers optionally draw the actual hill locations, even with line weight zero. |

**Open noise passages:** Source Noise; Grid 57 columns ×47 rows; Frequency 3.1; Source aspect 1.1; Width 440; Depth 340; Center 320/320; Levels 11; First level -.45; Level spacing .09; Line weight .9; Index lines on. Move Center to 430/240 and set Orientation 25 to compose as a smaller, tilted local fragment.

**Signed, ordered bands:** Source Saddle; Grid 49×37; Frequency 2; Aspect 1; Wave phase 45; Width 350; Depth 260; First level -.75; Level spacing .25; Levels 7; Index lines off. Compare with Waves at the same controls: both ignore seed and can produce negative as well as positive height values.

**Tiny authored patch:** Source Numeric grid; Columns/Rows 5/5; First level .5; Level spacing .5; Levels 5. Paste rows `0 0 0 0 0`, `0 1 2 1 0`, `0 2 4 2 0`, `0 1 2 1 0`, `0 0 0 0 0` on separate lines. Lower the Width/Depth to 120/120 and move Center to 190/460 to isolate the mark. Explicit values are seed-independent.

At most 12,000 surface-equivalent triangles and 150,000 grid cells × contour levels are permitted before field allocation. The source and extracted lines are cached independently of palette, line weight, orientation and position.

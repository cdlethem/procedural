# Path Materials: Stitched Contours starting recipe

Path Materials draws marks along a local family of seeded, bending trajectories. The Stitched Contours starting recipe emphasizes stitches; the Fragmented Lines starting recipe begins with broken dashes, and either can use all available materials. Marks are sampled by **traveled distance**, not by vertex number. A single corner-cut pass softens the source before sampling. Changing palette, mark shape, angle, size, gaps or omission does not move a trajectory. The canvas remains transparent; there is no background-colored eraser beneath the stitches.

| Control | Visible effect |
| --- | --- |
| Paths, Path separation | Number of independent trajectories and signed distance across their direction. Zero separation overlays paths. |
| Path span, Center X/Y, Direction | Actual local extent, placement and angle; no fit-to-page step. |
| Bend cycles, Crosswise bend, Travel fold | Curvature and overlapping folds; zero bend/cycles yields straight travel. |
| Source samples, Seeded disorder, Placement variation | Resolution and seeded trajectory variation, independent of the materials. |
| Mark spacing | Approximate arc distance between marks, including on unevenly curved sections. |
| Material | Continuous line, short dash, parallel paired stitches, cross-bars or filled tapered leaf-like polygons. |
| Mark length/width/angle | Length, paired separation or leaf breadth, and orientation relative to the local tangent. |
| Gap rhythm, Seeded omission | Periodically omit one after the entered number of retained slots, or omit independently with a fixed seeded random stream. Zero gaps/omission draws all available marks. |
| Stroke weight | Width of lines, dashes and bars; leaf polygons use mark width instead. |

**Local tuft:** Paths 7, Path span 85, Center X/Y 345/380, Direction 70, Path separation 9, Bend cycles 1.5, Crosswise bend 25, Travel fold 35, Material leaf, Mark length 16, Mark width 5, Mark spacing 8, Gap rhythm 0, Seeded omission .1.

**Curving ribbon:** Paths 3, Path span 470, Center X/Y 365/355, Direction -22, Path separation 18, Bend cycles 1.1, Crosswise bend 88, Travel fold 70, Material paired-stitch, Mark length 23, Mark width 10, Mark angle 65, Mark spacing 11. Try the same geometry with material line to see the underlying route.

The source builder uses the revised path-gesture trajectories, `geometry.chaikin-polyline-2d` softens them, and `geometry.resample-polyline-2d` places the marks. Excessive source points × paths or sampled marks fail a work budget before painting.

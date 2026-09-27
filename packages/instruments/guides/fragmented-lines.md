# Fragmented Lines: Path Materials starting recipe

The Fragmented Lines starting recipe opens Path Materials with broken dashes and gaps; the Stitched Contours starting recipe opens the same instrument with stitches. Seeded editable trajectories remain intact while fragments, rhythmic gaps and stochastic omissions change. Marks are placed at approximately equal **arc distances** along a smoothed source, with angles relative to the local tangent. Color and material edits do not rearrange the paths or regenerate the omission sequence.

| Control | Visible effect |
| --- | --- |
| Paths, Path separation | Number of broken traces and their signed offset across the direction. |
| Path span, Center X/Y, Direction | Length, placement and direction of this local group, not an automatic full-page repeat. |
| Bend cycles, Crosswise bend, Travel fold | Bends and forward folds; Seeded disorder and Placement variation change the trajectories, not the marks. |
| Source samples, Mark spacing | Underlying path resolution and approximate traveled distance between fragments. |
| Material | Dash by default; use paired-stitch, bar, filled leaf or uninterrupted line for alternate treatments. |
| Mark length/width/angle, Stroke weight | Length, paired offset or polygon breadth, rotation relative to the path, and line weight. |
| Gap rhythm | Keep this many slots, then omit one; zero disables periodic gaps. |
| Seeded omission | Independently remove marks, preserving previously retained positions as the probability changes. |

**Irregular broken traces:** Paths 12, Path span 470, Direction -16, Path separation 34, Crosswise bend 36, Travel fold 35, Material dash, Mark length 20, Mark spacing 12, Gap rhythm 4, Seeded omission .28.

**Sparse diagonal bars:** Paths 3, Path span 210, Center X/Y 270/410, Direction 40, Path separation 42, Bend cycles .8, Material bar, Mark length 12, Mark width 12, Mark angle 80, Mark spacing 18, Gap rhythm 2, Seeded omission .4.

The same revised path-gesture source and `geometry.chaikin-polyline-2d` are used before `geometry.resample-polyline-2d`; no opaque stroke hides gaps. Extreme source and sample combinations are rejected by a work budget.

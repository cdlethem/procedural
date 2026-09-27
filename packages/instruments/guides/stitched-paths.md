# Stitched Paths: Path Materials starting recipe

Lay transverse marks along editable local waves. This starting recipe shares the Path Materials construction used by Stitched Contours and Fragmented Lines: source geometry and its painted material are separate, so a few folded tufts are as practical as a broad stitched field.

| Controls | Canvas effect |
| --- | --- |
| Paths; Path span; Path separation; Center X/Y; Direction | Arrange short or long runs in a local footprint, without fitting them to the canvas. |
| Bend cycles; Crosswise bend; Travel fold | Bend across or along travel, producing waves, folds and reversals. |
| Seeded disorder; Placement variation | Perturb the source shape and individual path placement/phase. |
| Source samples | Resolve source polylines before their corner-cut smoothing pass. |
| Material; Mark spacing | Choose continuous lines, dashes, paired stitches, bars or leaves; separate marks follow traveled distance. |
| Mark length/width/angle; Stroke weight | Shape the painted material without rerouting its source. |
| Gap rhythm; Seeded omission | Leave regular or independently seeded gaps between retained marks. |

Try **small stitches** with Paths 3, span 130, separation 23, center (180,420), crosswise bend 12 and mark spacing 8. Try **folded leaves** with Paths 4, span 220, travel fold 100, crosswise bend 65, Material leaf and mark width 8. For **open thread**, choose Material line, reduce Paths to 2 and increase separation; a second layer with identical source settings can add stitches over those lines.

The generator uses explicit source paths, corner-cut smoothing and equal-distance `resamplePolyline2D` sampling. Source and sampling work are jointly bounded; excessive combinations fail rather than silently lose marks. Marks outside the canvas are not fitted back inside.

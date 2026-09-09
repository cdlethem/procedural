# Clip a drawing to a polygon

It cuts hatch strokes or a zigzag into the visible parts of a concave polygon. A notch can
split one source stroke into separate pieces.

[Install the Java library](building-java-from-source.md), then open **ClipMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| H | Switches between dense and sparse hatching. |
| N | Switches the polygon notch depth. |
| T | Switches between hatch and zigzag source strokes. |
| C | Switches uniform and alternating source-stroke colors. |
| M | Shows or hides clipped-piece endpoints. |
| O | Shows or hides the original strokes as a faint overlay. |
| 0 | Restores the starting composition. |
| S | Saves the displayed image. |

Replace `sources` with segments from your drawing. Keep each returned piece separate when
drawing it: joining pieces can draw across an excluded gap. Pieces retain their original source
index, so one color or mark rule can follow a source stroke after it is split.

The operation clips centerlines only. Thick strokes and endpoint dots may extend outside the
polygon; use a raster mask after drawing when the whole painted footprint must stay inside.
Recompute after changing source geometry or the boundary, then retain the clipped pieces for
style edits. See [Java performance guidance](java-performance.md) for larger geometry sets.

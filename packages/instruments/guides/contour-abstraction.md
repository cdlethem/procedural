# Contour abstraction

One sampled trajectory is repeatedly simplified into coarse-to-fine records,
then spaced perpendicular to its direction. These are open strokes, not a filled
terrain or a fixed full-canvas horizon.

| Control | Visible effect |
| --- | --- |
| Coarsest tolerance | First record keeps only its largest turns; each subsequent record uses a smaller tolerance and reveals more detail. Zero retains every sample. |
| Records, Path spacing | Number and signed separation of records of the *same* trajectory. Zero spacing stacks them directly. |
| Path span, Center X/Y, Direction | Length, location and orientation of the shared source. Short span makes a localized contour fragment. |
| Bend amplitude, Bend cycles | Signed reach and oscillation of the source along its direction. Zero amplitude is straight. |
| Forward bend | Lets the shared trajectory turn back on itself. Overlapping records can then read as open fans or folded ribbons rather than parallel horizons. |
| Noise blend, Seed | Changes the source's coherent irregularity; the seed only changes geometry, not the color. |
| Source points | Samples used to construct the trajectory before simplification; more points can preserve finer details. |
| Placement variation | Seeded shifts in where records lie; their source shape remains exactly the same. |
| Stroke weight | Width of the record lines, independent of the source and tolerance. |
| Show nodes, Node size | Optional retained simplified vertices with their own diameter, off by default. |
| Palette | Recolors records without regenerating the sampled source. |

Try a short span, steep direction and wide spacing to make a few floating
records; zero spacing reveals the coarse-to-fine differences along a single
line. Excessive source points and records hit a combined simplification budget,
not an implicit fit or a clamped setting.

Each record invokes `geometry.simplify-polyline-2d` on the common sampled
trajectory at a different tolerance.

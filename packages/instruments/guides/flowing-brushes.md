# Flowing brushes

Chaikin corner cuts turn sampled, angular trajectories into continuous brush sweeps.
Keep them as a transparent accent, overlap them into one thick band, or rotate the
whole family into diagonal strokes. Nothing paints the canvas behind the lines.

| Control | Visible effect |
| --- | --- |
| Brush paths, Path spacing | Number of strokes and their signed separation perpendicular to the chosen direction. Zero spacing overlays them. |
| Path span, Center X/Y, Direction | Length, position and angle of the source strokes; short spans make local tufts instead of full-width rows. |
| Bend amplitude, Bend cycles | Reach and rhythm across each path; zero cycles makes straight trajectories. |
| Forward bend | Pushes and pulls along the travel direction. Combine with bend amplitude to turn sweeps into folds, loops and overlapping curve fans. Zero keeps forward travel monotone. |
| Noise blend | Mixes coherent, seed-controlled irregularity with the analytic wave. |
| Source points | Samples of each input trajectory before smoothing; fewer points make larger angular decisions. |
| Placement variation, Seed | Independent displacement and phase variation between strokes; changing color does not regenerate the paths. |
| Corner cuts | Number of Chaikin passes, independent of the source geometry. |
| Stroke weight | Line width, independent of spacing and source paths. |
| Show nodes, Node size | Optional original sample points, independently sized; off by default. |
| Palette | Recolors the existing strokes without changing their geometry. |

Try a short 120-pixel span with a near-vertical direction and several overlapping
paths for a tuft. For a quieter counterpoint, use one long path, zero noise blend,
and a small amplitude. Large source counts and many corner cuts are subject to a
combined work limit; the slider ranges are not the full numeric limits.

The replaceable sampled source is refined by `geometry.chaikin-polyline-2d`.

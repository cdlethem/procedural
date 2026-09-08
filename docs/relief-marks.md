# ReliefMarks: recreate a faceted relief

ReliefMarks recreates the defining structure of
[`momito`](../survey/out/2019/generativos/momito/notes.md) using the existing Java library:
biased quadrant subdivision supplies cell centers, and Delaunay triangulation connects them.
The editable PDE draws sloped faces and thin, size-linked spike boxes. No new core operation
was needed. See [installation](installing-relief-marks.md).

The example retains871 cells from290 four-way replacements, triangulates their centers, and
selects spikes with an explicit example seed. A face's first two canonical vertices are raised
while its third stays at zero; two additional triangles draw the raised edge. These visible
vertex calls are the artistic face treatment, not a general solid-extrusion algorithm.

| Key | Edit | Retained arrangement |
| --- | --- | --- |
| C | Cycle the four source palette colours | Same cells, topology and spikes |
| H | Change relief height4/12 | Same topology and spikes |
| R | Increment seed and rebuild | New cells, topology and spike choices |
| 0 | Restore seed42, green and height4 | Recreated baseline |
| S | Save the completed canvas | No new draw or generation |

Edit the partition settings and spike selection in `ReliefComposition.java`; edit lighting,
projection and the face drawing helper in `ReliefMarks.pde`. These values are authored
settings. The source report contains no measured parameter variants establishing recommended
ranges for them.

This is a demonstrated **structural/technique recreation**, not an exact source replay.
Private package RNG, binary64 coordinates and canonical triangulator face order produce
different individual cells and wedge orientations. The source's camera jitter is replaced by
fixed quarter-turn tilts, and the accepted P3D run uses960×960 at density1. Clustered relief,
size-linked spikes and the lit oblique composition are preserved. The original note's
approximately1161 cells is inconsistent with290 replacements; the actual count is871.

[Native and visual acceptance](../evidence/reproductions/r1-p3d/root-review.json) covers all
four distinct rendered states, exact within-run reset pixels and cached saving. The original
postprocessing failure is preserved: an inherited640px image check and filename glob were
corrected against the existing960px captures without rerendering. Human usability and
source-pixel similarity have not been measured.

# Draw bands with room between them, then hatch their regions

Root admits five independently specified p5-first computations from plan C/E: strict-region
clearance, tapered strip construction, ordered strip selection, region hatching and an SVG
path sink. Before this work, offset centerlines and clipped simple polygons could not retain
variable-width valid bands, exclude thick overlaps or hatch holes. Existing tracing,
resampling and artist-selected marks remain composition inputs.

The September corpus SHA256 c25caa8edf07e11bf1f97cc5a1d70dd65a915620992bc0b3d3746c80ae59d209
motivates these tasks through Hobbs's Fidenza, Hoff's plotting and Sighack's hatching/process
examples. Source images establish visible tasks, not these independently designed rules.
No named artwork is automatically plausible or demonstrated by component acceptance.

An artist can change per-vertex widths and clearance without rewriting placement, retain
selected filled regions, and redraw them as river bands or glyph-like ribbons. Hatching
returns ordered path fragments that can be restyled as stitch marks. The SVG sink preserves
millimetre paths and pen lifts; it does not imply machine-safe G-code or fabrication.

The shared Region2D carrier is one simple outer ring and disjoint, strictly interior holes.
Exact input topology and exact squared clearance comparisons prevent rounded display distances
from deciding occupancy. There is no Boolean union, nested island, snapping or repair. Inner
corners trim at the adjacent side-line intersection; outer corners use bevel or bounded miter.
Invalid/collapsed strip topology is an explicit rejected candidate. Closed strips must be one
outer plus one hole. Both side boundaries follow centerline traversal; visible rings normalize
winding and start point. Query witnesses preserve input ring/edge indexing.

Selection composes strip construction and region relationship checks, retaining substitutions
for candidate paths, width profiles and exclusion geometry. Its conservative budget includes
exclusion complexity and every possible comparison; a cap does not silently omit validation.
Hatching adapts exact multi-ring segment clipping; ordinary tone selection and drawing remain
editable. These operations add reusable values rather than one artist-style generator.

Native acceptance requires crossing/endpoint/clearance edits, closed and sharp-corner cases,
negative-space holes, width-sensitive acceptance, independent appearance, reset/reload/save,
retained-geometry substitution and parsed SVG download. Separate analytical tests cover exact
ties, invalid rings, holes, normalized boundaries, work/output limits and representation
failures. Exact arithmetic may be costly; measure bounded tiny/study/stress configurations.
No recommended visual ranges or arbitrary polygon robustness is inferred from the corpus.

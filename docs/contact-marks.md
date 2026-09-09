# Stop strokes at their first obstacle

ContactMarks uses NearestSegmentContact2D to connect supplied positions to the first edge
of a supplied boundary. N moves one obstacle corner while retaining the source strokes;
C changes colors while retaining contacts; 0 resets; S saves the cached image. The example
is part of the Java0.35 development source bundle.

Supply `queries` and `obstacles` as lists of `[x0,y0,x1,y1]` in the same coordinate system,
and an explicit `maxWork`. Each query is directed from its first endpoint to its second.
The operation returns one contact or null per query. A contact exposes `obstacleIndex`,
`t`, `x` and `y`; use the index to retain your obstacle's color or other metadata.
`find(config).hitAt(i)` gives the contact for query i, and `toValues()` exports detached data.

Contact includes endpoints, origin touches and the onset of collinear overlap. If a stroke
already touches an obstacle, t is zero. For a ray web, explicitly leave rays from the same
emitting point out of that group's obstacles when they should not stop one another.
No hidden epsilon or self-exclusion changes the geometry. Misses are retained as null;
keeping, dropping or extending them is your composition's choice.

The query uses finite segments, so a miss may mean the stroke does not reach the obstacle.
This is distinct from clipping a stroke into every interior interval of a polygon; use
[ClipMarks](clip-marks.md) for that. Contact does not constrain the full painted stroke width.

Selection uses exact rational geometry before once-rounded binary64 output. An interior
contact that rounds onto a query endpoint throws `REPRESENTATION_COLLAPSE`, with queryIndex
and stage; no partial batch is returned. Exact endpoint contacts are valid. Returned points
may be slightly off an exact obstacle after rounding. The kernel shares package-private
ExactRational arithmetic with the clipper; that helper is not public API.

`maxWork` bounds queryCount × obstacleCount pair tests, not milliseconds or memory. The
implementation is suited to retained geometry and explicit edits. A measured256×256case
allocated about162MB despite only65536pair tests; exact arithmetic is not allocation-free.
Use bounded batches and retain results for style edits. No artistic count range, frame-rate
promise or full plasma007 recreation is claimed. See the
[scoped native review](../evidence/workflows/contact-marks/root-review.json).

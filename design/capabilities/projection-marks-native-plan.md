# ProjectionMarks — preregistered native workflow

Candidate plan, not implementation/native acceptance. Use the frozen DiscProjection2D
contract once root approves it; no private prototype algorithm in the public example.
JAVA2D720x480, density1, no assets. Show a sampled closed contour and an open line family
using the same point transform, with finite canvas-scale overlapping circular influences.
Distinct consumers demonstrate transfer without adding another deformation algorithm.

Generate supplied point buffers once. Preserve line/contour grouping as example-owned
index ranges; the core receives ordinary packed points and knows nothing about topology.
Use stable ordered discs and reversed order, and authored strength choices0.45,1,0.
Retain six transformed outputs (three strengths by two orders); compute them during setup
with explicit maxTests=N*M, then reuse across all display edits. No recommended strength
range or default follows from these example settings. Use source geometry, influence
outlines and transformed geometry in distinguishable colors. Lines near overlap should
be off-center so order effects are visually legible. Never change coordinate frames
between variants; display translation is separate from projection input coordinates.

M cycles0.45 ->1 ->0 ->0.45; O reverses the supplied influence order; C changes drawing
colors. S saves the cached opaque displayed composition. Eight states: baseline,full,zero,
strength-restored,reversed,recolored,colors-restored,order-restored. Keys mmmoccos, with
cached save following the last frame and at least300ms quiet. Real dirty display loop;
probe must not replace it with noLoop/redraw behavior. Zero-strength shows original point
geometry; restored images must match exactly. Every intended changed frame must differ.

Probe verifies input point/disc buffers and each retained result identity and value, plus
setup computation count6; changing display settings never reruns projection. Colors and
mode update a display cache only. Framebuffer equals cache, save equals final cache.
Assert core class origin in combined candidate and separate extracted core JAR. Renderer
is actual PGraphicsJava2D density1; render through shared machine lease.

Root inspects baseline,full,zero,reversed,recolored. Ordered influences may reintroduce
points into earlier discs, and projected samples joined by segments do not prove segment
exclusion. Do not label the result collision-free, clipped, Voronoi or a recreation of
colidion. Native acceptance demonstrates scoped useful geometric deformation only.
Performance: tiny/example/stress point-by-disc counts, explicit setup cost and output
checksum, primitive-buffer storage. Reuse focused harness conventions; no new executor.

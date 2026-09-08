# CP5 investigation — give supplied shapes grain

Status: root-selected next Java capability investigation after CP4 delivery. This is a
usage and boundary decision, not a frozen public contract or implementation admission.
Sol stays paused. Existing triangle ledger entries remain provisional and unchanged.

## Artist task and why now

Start with a few supplied triangular regions. Fill them with a repeatable point texture,
change its density, recolour without moving points, and replace dots with short strokes.
Then apply the same content to triangles obtained by splitting CP4 retained rectangles.
This connects a new sampling capability to an existing region workflow instead of adding
another disconnected demo. This sequencing is root's product decision, not a measured
artist preference or a claim that this exact composition appears upstream.

The algorithmic burden is controllable triangle sampling with explicit, repeatable random state and
usable retained output. Area-based count allocation should be understandable from the
example. Colour, opacity, stroke shape and source triangle construction stay substitutable.
A single-point helper alone is not the acceptance target: the delivered workflow must make
thousands of reusable positions practical without requiring artists to manage RNG words.

## Evidence read directly by root

- `survey/out/2018/Generativos/puntis/notes.md`: candidate 0 is described as combining uniform triangle
  points with stipple drawing; that distribution description is contradicted below. The reported density substitution 1.1 to 4.0 is large;
  alpha 90 to 220 and palette substitution are moderate. Root subsequently verified the
  active loop uses sqrt of a product of two uniform draws, concentrating points toward
  the first supplied vertex; it is not uniform area sampling. The note calls 4.0 four times the density, although 4/1.1 is
  approximately 3.64; do not repeat the rounded multiplier as exact.
- `survey/out/2018/Generativos/puntis2/notes.md`: candidate 1 is the single-point
  `randInTri`, while candidate 0 includes site generation, Delaunay and rendering.
  The note lists no parameter substitutions, but the stored variant metadata includes a
  density edit; the grain audit distinguishes that missing prose from missing evidence.
  These are separate computation scopes.
- `survey/out/2018/Generativos/puntis3/notes.md`: candidate 1 stipples an already filled
  triangle. The reported 2.1 to 6 density edit also shifts later colours and scatter
  through the shared random stream. Root verified the initial per-dot brightness variate
  is overwritten by a fresh draw before coordinate computation. The second coordinate
  uses a separately biased product. The note summary omitted both facts; it does not
  establish uniform sampling or direct brightness/position variate coupling.

The sample image descriptions above come from notes; root has not inspected those original
survey PNGs here. Prior private triangle engineering work, if any, is not this workflow's
acceptance evidence. The completed [grain audit](grain-evidence-audit.md) records exact note/source hashes and
variant facts. Both puntis files are byte-identical at the pinned revision; their uniform
helper is unused by the active grain pass. Root read both active sampling expressions and
the unused helper directly. Site generation also precedes the explicit random reset.

## Boundary to compare before admission

Before selecting distribution semantics, compare the standard uniform helper against the
active puntis first-vertex concentration and puntis3 second-coordinate bias. Do not combine
these distinct algorithms under an undocumented uniformity claim. A clean public mapping
from explicitly supplied unit coordinates may offer distribution substitution, but must be
compared with a convenient seeded batch in the complete workflow rather than imposed as
per-point boilerplate. No bias control or enumerated strategy is admitted yet.

Investigate a seeded retained triangle sample result with an explicit sample count as the
minimal useful batch operation. A caller supplies triangle vertices and a seed, receives
indexed positions, and reuses them across appearance edits. No API spelling, numeric bound,
RNG consumption, zero-area policy or output representation is frozen by this proposal.

Compare it in a complete example with the existing single-point candidate plus a private
seeded batch wrapper. If caller-side batching is necessary in every use, the public batch
may be the better operation; avoid exposing both merely to increase function count.
Likewise, demonstrate area-to-count allocation in ordinary example code before deciding
whether a mesh-wide density convenience removes enough repeated work to earn public API.
The current ledger's single-point boundary may need explicit revision after this comparison.

Do not hide triangulation inside sampling. Supplied triangles suffice for this capability;
a Delaunay operation requires its own topology/dependency decision and remains open.
Do not silently treat arbitrary polygons as triangles or triangulate nonconvex shapes by
an unsafe fan. Rectangle-to-two-triangle conversion is an explicit, valid transfer case.

## Private walkthrough and acceptance questions

Prepare a small Java-only prototype and a predeclared image plan, with no renderer launch
until root reviews the source, work budget and plan. Use an authored nondegenerate triangle
layout so the sampling mechanism can be inspected without a Delaunay dependency.

1. Distribution comparison first: same supplied triangle and count with uniform helper,
   first-vertex-biased puntis sampling and puntis3 coordinate sampling; retain each result.
   The plan must include these distinguishing images before the subsequent workflow edits.
2. Baseline: supplied triangles, explicit counts derived from area, retained sample points.
3. Density edit: more points in the same triangles; record per-region counts and whether
   the chosen stream design preserves each lower-count prefix. No unproved prefix claim.
4. Style edit: retain exact points and change colour/opacity independently.
5. Mark substitution: reuse the points as centres of short strokes. State clearly whether
   only centres, rather than whole strokes, are guaranteed to remain inside each triangle.
6. Transfer: take a small fixed CP4 partition, split every rectangle into two triangles,
   and apply the same sampler/content path. Keep geometry generation independent of colour.

Use a bounded total sample budget and reusable traversal buffers. Measure allocation and
work before increasing density. Preserve count conversion (including fractional products),
triangle winding, random consumption, endpoint handling and degenerate cases as explicit
questions for the eventual contract and distinguishing fixtures. A meaningful distribution
check must distinguish intended uniform and biased constructions, not just containment.
For the uniform helper, expected barycentric weights are (1/3,1/3,1/3). For active puntis,
E[sqrt(UV)] = E[sqrt(U)] E[sqrt(V)] = 4/9, giving weights (5/9,2/9,2/9).
This analytic distinction follows from independent ideal continuous uniform variates; it
is not an empirical claim about an unrendered image or exact finite PRNG sequence.

Independent layout/style randomness is a deliberate design divergence from shared-stream
source sketches. Public-stream pixel identity is not a goal. No continuous recommended
parameter range is established by the discrete source experiments or this plan.

## Other entry points remain active research

Root also read Arboles and brotes: terminal-child recursion and repeated cuts into a live
line pool have different attachment/stopping semantics and must not merge just because
both resemble branches. The completed branching audit and root source review also correct the note’s list-index
bias and depth-stop shorthand; see [branching evidence](branching-evidence-audit.md).

Root read cilindros and fieeee: cilindros constructs actual P3D cylinder sides and caps;
fieeee's note describes profiled 3D vertices flattened into a 2D texture. That second note
cannot alone establish a general profiled P3D mesh claim. A future mesh capability must
separate topology, normals, attributes and camera/light choices with an actual P3D example.

Root read textureGridText: repeated glyph placement is useful as an early host-bound
substitution, but its unmeasured trail parameters and fallback font do not justify a new
portable typography operation yet. This is postponement of admission, not family rejection.

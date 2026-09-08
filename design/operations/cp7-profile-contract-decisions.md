# CP7 root contract drafting decisions

Status: architect-owned drafting worksheet after reviewed dependency admission for
`mesh.radial-profile-surface-3d`. This is not a second schema or implementation approval.
The catalog will be the sole normative schema. Root reviewed the source evidence and
seven-image comparison; [the selection](../capabilities/cp7-profile-selection.md) explains
the artist task and responsibility split.

## Selected data and domain

One generator accepts required `profile`, `slices`, `capStart`, `capEnd`, `maxFaces`.
`profile` is an ordered list of `[z,radius]` pairs in caller-supplied local distance units.
There are at least two pairs. All coordinates are finite binary64 values; axial coordinates
strictly increase; radii are nonnegative at the endpoints and strictly positive internally.
A two-point profile with both radii zero is invalid. No sorting, interpolation, resampling,
profile preset, angle offset, or supplied callback is implicit. The caller can construct a
cosine profile or use ordinary renderer transforms without adding public generator modes.

`slices` is an integer at least3. Endpoint closure flags are actual booleans. A positive
endpoint ring receives a fan when its corresponding flag is true; a zero-radius endpoint
is already one pole vertex and receives no extra cap regardless of the flag. Flags are
independent, so one open end is expressible. There are no library defaults or encouraged
numeric intervals. Document the private8/32slice configurations and source128slice usage
as observations only, with their confounds and provenance.

The result owns `positions`, `triangles`, `normals`, `faceKinds`, `bands`, and `cells`.
Positions and normals are triples of binary64 values, triangles are triples of integer
position indices. Face kinds are `side`, `start-cap`, or `end-cap`; caps have band=-1,
and every triangle has its angular cell index. Other face arrays have one entry per
triangle. A side band's index identifies the pair of supplied profile points it joins.
Both triangles in one ordinary quad share band/cell identity. The public start/end naming
clarifies their relation to the profile; the private prototype called these bottom/top.

The proposed Java class is `org.procedurals.mesh.RadialProfile3D` with `generate(Object)`.
It will expose counts, owned indexed vertex/triangle/normal reads, face-kind/band/cell
reads, allocation-free reads into supplied buffers, and detached value serialization.
Exact method names and query errors are catalog work; do not implement aliases or a
separate cylinder helper. A repeated drawing loop reuses retained normals and geometry.

## Counts, work and ownership

Let P be profile length, S the angular slice count, K the number of positive-radius
profile points, Z the number of poles (0..2), and C the number of requested caps on positive
endpoint rings. Then V=K*S+Z+C. Each positive-to-positive band emits2*Striangles; a
pole-adjacent band emitsStriangles. Each cap emitsStriangles. Sum to obtain F before
generating vertices or allocating output geometry. Use exact wide integer arithmetic.

Select maxFaces as an explicit caller work bound. The representation ceiling proposed for
it and for slices is715827881: in this domain V<=F+1, and triples for up to715827882vertices
fit signed32-bit array indexing. This is representability, not a recommended workload,
available-memory claim or assurance that the VM can allocate its largest legal array.
The contract must verify the count inequality and integer calculations in fixtures before
freezing this ceiling. Array allocation can fail well below it.

Validate the complete static input before evaluating capacity or geometry. Exceeding the
caller face budget fails explicitly before output allocation; never return a truncated
mesh. Core work and retained storage are O(P*S), with O(1) indexed access. Avoid per-face
objects, parsing or temporary vectors in generation/drawing loops. Incoming mutable
collections and all returned value copies must not mutate retained geometry. Into-reads
validate index and destination before any write; rejected reads leave the destination
unchanged. Native workload checks must include a tiny mesh, the demonstrated profile,
and a bounded larger mesh, with checksums and honest allocation observations.

## Coordinates and ordered topology

The local Cartesian axis is Z. Angles increase from +X toward +Y around that axis. Use
binary64 TAU=6.283185307179586; theta=(TAU*cell)/slices in that evaluation order. Evaluate
named target sine/cosine at theta; position=(radius*cos(theta),radius*sin(theta),z).
All exported zero-valued scalars are canonical +0. There is no RNG, time or host state.

Append profile rings in input order. Positive rings have Scells; a pole has one exact
(0,0,z) position. Do not evaluate or duplicate a2pi seam vertex: indices wrap moduloS.
Append cap centres after the profile positions, start before end where present.

Visit side bands in profile order and cells in increasing order. For an ordinary cell
with a=lower/current, b=lower/next, c=upper/next, d=upper/current, append (a,b,c) then
(a,c,d). At a start pole append (pole,upper/next,upper/current). At an end pole append
(lower/current,lower/next,pole). After sides, append start fans as
(centre,ring/next,ring/current), then end fans as(centre,ring/current,ring/next).
Thus side winding is outward, start caps face-Z and end caps face+Z. Indexed topology
and all face metadata are exact; coordinate tolerances must not excuse an index change.

## Flat normals and unrepresentable geometry

Select the per-edge/cross scaling evaluated in
[the numeric review](../../evidence/investigations/cp7-normal-numeric-review.json).
For each ordered triangle(a,b,c), subtract u=b-a and v=c-a componentwise. Reject a
nonfinite edge component. Compute su=max(abs(ux),abs(uy),abs(uz)), likewise sv; reject
a zero edge scale. Divide each ucomponent directly by su and each vcomponent directly
by sv. Do not multiply by a reciprocal, which can overflow for subnormal scales.

Compute the cross of the scaled edges with separate binary64 multiply/subtract operations,
in x,y,z order. Let sn=max(abs(nx),abs(ny),abs(nz)); reject sn=0. Divide cross components
directly by sn, giving q. Compute length=sqrt((qx*qx+qy*qy)+qz*qz), then unit=q/length
componentwise. Canonicalize output zeros. No FMA, reassociation, unrequested epsilon or
analytic profile-normal substitution is permitted. These normals describe the selected
rounded triangle construction and retain deliberate flat facets.

This avoids direct cross-product overflow and norm-square overflow/underflow in demonstrated
cases, but does not claim all-finite robustness. Opposite extreme coordinates can overflow
edge subtraction. Nearly parallel edges can lose a tiny perpendicular component during
normalization and produce a zero rounded cross. Minimum-subnormal radii can generate
coincident angular positions. Such cases fail explicitly with the first face index and
reason; no NaN normals, silent face omission or automatic lower resolution is allowed.
Define static invalid input, face-budget exhaustion, allocation failure and dynamic geometry
failure separately in the catalog. Only realizable dynamic stages need golden witnesses;
do not invent reachable overflow in bounded normalized products.

The private direct-normal renderer and proposed scaled computation differed by at most
6.245004513516506e-16per component over its4,496distinct faces. This is a measured
moderate-case comparison, not a universal tolerance or claim of rendered pixel identity.

## Remaining freeze work

For the catalog draft, use these error/access decisions. Static validation proceeds through
outer passive record/exact keys, profile outer list/length, then each pair shape/z/radius
in list order (including monotonicity and endpoint/interior constraints), then the special
two-pole check, slices, capStart, capEnd and maxFaces. Static failures use INVALID_INPUT.
After all static validation, compute exact counts and compare F to maxFaces; exceeding
it uses FACE_LIMIT_EXCEEDED before geometry allocation/arithmetic. Allocation failure
remains a host resource exception, as in existing retained operations, never INVALID_INPUT
or partial success. No portable allocation-success guarantee is made.

Generate positions/topology, then visit faces in canonical order for normals. Dynamic
failure uses MESH_ARITHMETIC_INVALID with faceIndex and stage `edge`, `edge_scale` or
`cross_scale`. A nonfinite edge has stage edge; a zero su or sv has edge_scale; a zero
rounded cross has cross_scale. Within a face evaluate the ucomponents in x/y/z order,
then vcomponents, then scales and cross. Static and face-limit errors precede all these.
Normalized finite operations cannot overflow under their established component bounds;
defensive checks do not create fictitious required reachable failure cases.

Use `vertexCount()`, `faceCount()`, `vertexAt(index)`, `triangleAt(index)`,
`normalAt(index)`, `faceKindAt(index)`, `bandAt(index)`, `cellAt(index)` and `toValues()`.
At-reads return fresh triples; counts/scalars are direct reads. Use `vertexInto`,
`triangleInto`, `normalInto` with index/destination/offset. Destinations are native
double storage for vertex/normal, native integer storage for triangle. Validate a finite
safe nonnegative integer index (INVALID_INDEX), then its range (INDEX_OUT_OF_RANGE),
then destination/offset/capacity for three elements (INVALID_OUTPUT). Preserve every
destination element on failure and all elements outside the three written slots on
success. Native scalar carrier handling follows existing retained-operation conventions;
the final catalog must enumerate it rather than relying on this reference alone.

Create the catalog entry with exact static/dynamic error precedence, native carriers,
ownership/query semantics, representation limits and target declarations. Specify field-
and case-specific trig/normal tolerances; ill-conditioned near-collapse cases must not
gain an unexplained global epsilon. Include exact small topologies, all closure/pole
combinations, seam and winding mutations, retained normals, invalid profiles, count limits,
subnormal/direct-division witnesses and reachable geometry failures. Cross-target behavior
must distinguish same-runtime replay from permitted transcendental variation.

Java is the first implementation target; other targets remain explicitly unvalidated.
Core generation needs no renderer. The future editable starter requires actual P3D depth
and lighting with explicit transforms; its native installation and visual checks remain
separate. Existing scoped llvmpipe evidence does not certify hardware or clean shutdown.
No renderer run or public implementation is authorized by this worksheet alone.

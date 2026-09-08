# ClosedSpline2D 0.1.0 — normative numeric semantics

Operation `geometry.closed-spline-2d`, decision cluster `geometry.closed-spline`.
Root contract preparation after the CP16 source/probe review and successful ledger gate.
This file specifies arithmetic; the catalog is the only schema authority. Java is first;
all other target implementations remain deferred. No renderer, RNG, time or assets are read.

## Data and native entry points

Create from exactly `{controls, subdivisions}`. Controls is an ordered list of N exact
`[x,y]` pairs, N>=3, finite binary64 coordinates in caller drawing units. Subdivisions R
is an integer>=1, the number of equal-parameter chords in each control-to-control span.
Both are required; no defaults or encouraged artistic ranges. R is an accuracy/work choice,
not a guaranteed length error or a source-derived aesthetic recommendation.

The Java class is `org.procedurals.paths.ClosedSpline2D`. Provide `create(Object)` and
`create(double[][] controls, int subdivisions)` sharing validation and one kernel;
`serialize()` returns only the detached controls and subdivisions descriptor. Queries:
`sampleParameter(double)` and `sampleDistance(double)` return immutable `Sample` with
`x(), y(), tangentX(), tangentY()`; corresponding `(double, double[] target)` overloads
write exactly four entries `[x,y,tangentX,tangentY]` into a supplied length4 array without
allocation. A `sample(Object)` interchange query accepts exactly `{mode,value}` with
mode `parameter` or `distance` and returns `{point:[x,y],tangent:[dx,dy]}`.
`length()`, `controlCount()` and `subdivisions()` expose retained metadata.
No generic callbacks or mutable internal buffers are exposed.

Tangent is the analytic derivative with respect to the local uniform span parameter,
NOT a unit vector or derivative with respect to distance. It can be zero. Native drawing
may use atan2 on nonzero vectors; choosing a mark orientation at a stationary point is
explicit caller policy. Uniform curves may overshoot and self-intersect; no simple polygon,
convexity, safe triangle fan, or true equidistant point-spacing guarantee is supplied.

## Input validation and ownership

Object records require exact keys and List containers; numeric carriers are only Java
Byte, Short, Integer, Long, Float and Double. Reject null, boolean, strings, arrays in
object route, arbitrary Number subclasses, BigInteger and BigDecimal. Convert approved
coordinate carriers to binary64; validate R as finite integral before narrowing. All zero
coordinates normalize to positive zero. Typed arrays are copied. Inputs must remain
stable during a call; later mutation cannot affect the curve. Exports are newly owned.

Validate top-level keys, control count, R, and product bounds before visiting coordinates
in row order, x then y. N<=268435455 permits packed8N coefficient storage; N*R<=2147483646
permits a signed32 indexed cumulative table of N*R+1 entries. These are representation
bounds, not promises that an allocation fits available memory. Work is O(N*R), retained
storage O(N*R+N); no hidden adaptive refinement. Resource exhaustion is not INVALID_INPUT.

After coordinates, construct coefficients in span order, x then y, then the table in span
and subdivision order. A nonfinite computed intermediate during creation yields
NUMERIC_OVERFLOW, without exposing any curve. Duplicate and all-coincident controls are
allowed. No sorting or point removal. No zero-chord pruning changes index identity.

## Arithmetic profile

All primitives separately round IEEE754 binary64, nearest ties-to-even; no FMA,
reassociation or extended intermediates. The following expressions use left-to-right
addition/subtraction, normal multiplication precedence, and explicit temporaries. For
span i, p0=control[(i-1+N)%N], p1=control[i], p2=control[(i+1)%N],
p3=control[(i+2)%N], compute independently for x and y:

```
a = 0.5 * (((-p0 + 3*p1) - 3*p2) + p3)
b = 0.5 * (((2*p0 - 5*p1) + 4*p2) - p3)
c = 0.5 * (-p0 + p2)
d = p1
position(t) = ((a*t + b)*t + c)*t + d
tangent(t) = (3*a*t + 2*b)*t + c
```

Check every primitive result for finiteness. At t=0 return p1 exactly and tangent c;
at t=1 advance to the next span and use its t=0 rule. This endpoint rule applies to
construction samples too. Canonicalize all exposed zeros to +0.

Construction evaluates positions only; derivatives are evaluated for queries.

Distance uses `hypot(dx,dy)` with fdlibm5.3 semantics as provided by Java StrictMath.hypot;
dx=x1-x0 and dy=y1-y0 must themselves be finite. This is an exact elementary-math profile,
not permission for port-native hypot variation. Ports must implement/verify that profile
before claiming exact support. There are no trigonometric functions in the core.

Build cumulative[0]=0. For each span i, start at control[i]; for j=1..R evaluate at
binary64 j/R (j=R uses the exact endpoint rule), measure the chord from the preceding
sample, and add its length to the running total. Store each running total in order,
including zero chords and rounded plateaus. Retained length is the final total. It is
an approximation to arc length, not an analytically integrated perimeter.

## Queries

Validate all queries as finite permitted numeric values before a constant-curve shortcut.
Invalid query key, mode, carrier, nonfinite scalar or target length/null gives INVALID_QUERY.
For target-array overloads validate scalar, then target, then calculate into locals;
no error may partly modify the target. No input/export aliases are retained.

Wrap finite value v to period P using binary64 remainder (quotient truncated toward zero):
w=v%P; if w<0 set w=w+P; if w==P or w==0 set w=+0. The equality-to-P correction handles
rounding of tiny negative values. Never compute floor(v/P)*P, which can overflow or lose
more precision. Parameter queries use P=N and select i=floor(w), t=w-i.

Distance queries with total length0 return control0 and its span0 tangent after query
validation. Otherwise wrap by P=length. If w==0, use span0,t=0. For w>0 locate the largest
index k with cumulative[k]<=w, using upper-bound binary search. The final total is greater
than w, so k+1 exists and cumulative[k+1]>w. This skips equal-distance plateaus deterministically.
Compute u=(w-cumulative[k])/(cumulative[k+1]-cumulative[k]); then
span=floor(k/R), local=(k%R+u)/R, each primitive separately rounded. Evaluate that cubic;
if local==1 use the endpoint rule. A nonfinite intermediate during query is NUMERIC_OVERFLOW.
Queries are O(1) for parameter, O(log(N*R)) for distance; reusable-array overloads allocate
nothing. No output contains a partial result. serialize/query maps and immutable Sample
results intentionally allocate detached objects.

## Validation scope

Exact schema/serialized descriptors, errors, counts and all fixture outputs. Distinguish
parameter from distance queries with unequal spans and curved spans; test periodic negative
queries, exact seam and control interpolation, a constant loop, repeated controls/plateaus,
invalid carriers and counts, arithmetic overflow, target atomicity and ownership.
Use analytical collinear cases with exact dyadic evaluations plus an independently reviewed
curved calculation; do not generate all golden values by calling the implementation.

Measure small, source-like (400 curves,3 controls) and stress setup/traversal using actual
calls and output checksums. R values from the CP16 probe establish numerical investigation,
not a public default. Native LoopMarks must show a control edit, independently recolor
retained geometry, and change marks using retained curves. No native/distribution acceptance
is implied by a compiled core or this contract. Neither blobs nor databol earns original
recreation credit without full composition execution and declared fidelity review.

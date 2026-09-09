# RadialPull2D 0.1.0 — normative semantics

Operation/decision cluster `geometry.radial-pull-2d`. Root approves this boundary for Java
implementation after the CP19 source review, four private renders and ledger contract gate.
Catalog owns schemas. No core, native public workflow, distribution or port acceptance yet.

## Responsibility and data

An immutable ordered field of explicit influences. Create from exactly `{influences}`;
each influence is exactly `[centerX,centerY,radius,power]`. All values are finite binary64;
radius and power must be strictly positive. Coordinates/radius use caller drawing units,
and power is dimensionless. Empty list is identity; duplicates contribute repeatedly.
No default or recommended interval. The private radius120/180 and power2/0.5 examples
are observed configurations, not a continuous useful range or a library default.

Each query is exactly `[x,y]`, finite coordinates in the same frame. Return `[x',y']`.
Axes and origin follow caller geometry. There is no renderer, RNG, noise, time, field
sampling grid, angle conversion, clipping, inverse, derivative or polygon construction.
The operation may fold and self-intersect geometry. It is discontinuous at influence
centers and cannot promise preservation of topology or smoothness. At an exact center
that influence contributes zero, a deliberate departure from source positive-x behavior.
Other influences still apply there. Radius endpoints have zero contribution.

## Validation and ownership

Object interface: exact Map keys and List containers; no Java arrays in interchange input.
Only Byte, Short, Integer, Long, Float and Double numeric carriers, converted to binary64.
Reject boolean/null/string/nonfinite/arbitrary Number, BigInteger and BigDecimal. Normalize
all exposed zero values to positive zero. Typed descriptors and serialization are detached.
Inputs must remain stable during calls; later caller mutations cannot alter the field.

Validate constructor top-level shape, influence count, then each row shape and its four
values in order. N<=536870911 permits packed4N signed32 array storage; no artistic or
available-memory guarantee follows. Construction/serialization is O(N) work and storage.
No hidden center generation or parameter normalization changes the given radius or power.
Wrong construction yields INVALID_INPUT. Query validates pair shape and x then y before
computing, including identity/empty fields. Invalid query/carrier/target is INVALID_QUERY.
Out-of-memory/resource exhaustion remains runtime failure, not a portable geometry result.

## Arithmetic and ordering

Every primitive +,-,*,/ separately rounds IEEE754 binary64 nearest ties-to-even. No FMA,
reassociation or extended precision. `hypot` and `pow` use fdlibm5.3 IEEE-core semantics
under these floating rules (Java StrictMath on the pinned JDK), following the existing
ClosedSpline2D/line-pool portable-math policy. Ports must implement these named algorithms,
not silently substitute host transcendental functions or enlarge tolerances. Exact fixture
coordinates/errors/ordering are compared exactly; visual tolerances are a separate concern.
No copied fdlibm implementation is introduced in the Java library.

Initialize sumX=+0,sumY=+0. In supplied influence order, always using the original query:

1. dx=centerX-x; dy=centerY-y. If either difference is infinite, skip this influence:
   exact separation exceeds every finite radius. Do not subtract from a previously moved point.
2. d=hypot(dx,dy). If d==0 or d>=radius skip; an infinite hypot is therefore also outside.
3. t=d/radius; f=pow(t,power); remaining=1-f; amount=radius*remaining.
4. ux=dx/d; uy=dy/d; contributionX=ux*amount; contributionY=uy*amount.
5. sumX=sumX+contributionX; sumY=sumY+contributionY. Any nonfinite contribution or sum
   yields NUMERIC_OVERFLOW. Do not reorder contributions or cancel opposite terms first.

Finally resultX=x+sumX; resultY=y+sumY. Nonfinite result yields NUMERIC_OVERFLOW.
Normalize returned zeros. Tiny d/r may underflow to0; pow(0,positive)=0 is retained.
Near-rim d/r may round to1; zero contribution is retained. There is no global epsilon,
clamping, skipped small contribution, or center exclusion radius. The exact-center zero
policy does not make the limiting field continuous. Sum displacements first, then add the
query once; this freezes source-like accumulation rather than private prototype addition
into the output at every iteration. Floating addition order is observable even though the
mathematical field is a sum.

## Java surface

`org.procedurals.geometry.RadialPull2D` is final and immutable. Provide:

- `create(Object descriptor)` and `create(double[][] influences)` with common validation;
- `serialize()` returning a fresh Map/Lists descriptor; `influenceCount()`;
- `transform(Object query)` returning a fresh two-number List;
- `transform(double x,double y)` returning immutable `Point` with `x()` and `y()`;
- `transform(double x,double y,double[] target)` writing exactly two entries into a length2
  array. Validate coordinates, then target, calculate into locals, and commit both entries
  only after success. This hot path is allocation-free and O(N).

Nested `PullException extends IllegalArgumentException` exposes public final String `code`.
No partial result/target mutation on ordinary validation or numeric failure. No cache or
query-history state. Implement one arithmetic kernel for all query paths, not independent
interchange and typed evaluators. Null/incorrect target length fails even on an empty field.

## Verification and next acceptance

Independent fixtures must distinguish empty/center/rim/outside, negative coordinates,
duplicates, analytic cardinal and off-axis pulls, fractional power, overlap sum versus
sequential update, input/output ownership, zero normalization, coordinate-difference
infinity outside all radii, sum/output overflow, and invalid configuration/query values.
An exact dyadic cardinal case: center(200,240),r120,p2 at(260,240) returns(170,240).
Two centers(0,0),(10,0),r10,p2 at(5,0) return(5,0); sequential would return(-2.5,0).
Non-dyadic fdlibm vectors need a separately reviewed oracle, not implementation self-output.

Measure actual small, source-scale and bounded larger influence/query workloads with a
checksum and allocation-free hot path. Native PullMarks must support radius/power edits,
retained recoloring, contour transfer, reset and cached save using the real core. The
private study proves design utility only. Curvespace structural recreation remains pending;
curves_str sequential push and culin stochastic updates are deliberately not absorbed.

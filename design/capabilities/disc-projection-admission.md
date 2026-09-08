# Sequential disc projection — root admission and numeric brief

Root admits the reusable point transform established by colidion#1 and the independently
rendered contour/open-line study. Artist task: make existing geometry yield locally to
circular influences, retain it, then change drawing style without recalculating geometry.
Study evidence: evidence/parameter-experiments/disc-projection/root-review.json. The complete
flattenCircle composite is not equivalent to this operation. Keep owner sampling/blending,
neighborhood construction and source fill heuristics outside this component; they remain
caller composition or deferred algorithms. No Voronoi/containment/collision claim.

Selected Java name: org.procedurals.geometry.DiscProjection2D.project. Object input exactly
{points:[[x,y],...],discs:[[cx,cy,radius],...],strength,maxTests}. Typed input project(
double[] packedXY,double[] packedDiscs,double strength,long maxTests). Arrays can be empty;
point array length even, disc array length divisible by3. All coordinate values finite
binary64; radius strictly positive; strength finite[0,1]. maxTests required safe integer
[0,9007199254740991]. Mathematical interpolation domain, not an encouraged artistic range.
No defaults. PositiveX direction at exact disc center is explicit independent design.

Result immutable with size(), pointInto(long index,double[] target,int offset), points()
detached packedXY and toValues() detached {points:[[x,y],...]}. Follow existing six Java
numeric carriers for Object inputs; Map exact keys and List rows, sequential List traversal.
Inputs stable for call; no retained aliases; output zeros normalized to positive zero.
Result point count equals input point count, order preserved. Coordinate units are caller
units, same across points/discs; x right and y down in the example, algorithm axis-neutral.

Validate all input before work check: exact top keys, points outer size (2*N<=INT_MAX),
row shapes and values, discs outer size (3*M<=INT_MAX), rows/finite values/positive radii,
strength then maxTests. Typed form validates point count/values, disc count/values, then
strength/budget. INVALID_INPUT precedes WORK_LIMIT. Exact declared work N*M in signed64;
count every disc even at strength0. If work exceeds budget fail WORK_LIMIT before output
allocation or geometric traversal. Input conversion buffers may allocate before preflight.
No output published on failure. O(N*M+N+M) work, primitive-array storage, no per-point objects
in typed loop. Object data conversion must be linear for LinkedList as well as ArrayList.

Process input points in order, discs in supplied order, updating current x,y after each
interaction. At strength0 copy validated points with canonical zeros after budget check.
For each disc calculate dx=x-cx and dy=y-cy. If either subtraction overflows to infinity,
leave the point unchanged for that disc: its distance exceeds every finite radius.
Otherwise let hi=max(abs(dx),abs(dy)),lo=min(...). If hi==0, d=0. Else ratio=lo/hi;
square=ratio*ratio; root=sqrt(1+square); d=hi*root. If d overflows it is outside the disc.
If d>=radius, preserve current point. Otherwise direction=(dx/d,dy/d), except d==0
uses(1,0). gap=radius-d; movement=strength*gap; mx=ux*movement; my=uy*movement;
newX=x+mx; newY=y+my, ordered separate binary64 operations. Nonfinite new coordinates
fail NUMERIC_OVERFLOW with no result. Normalize signed zero only for completed output.
No FMA, reassociation, epsilon, trigonometry, gamma or mutable global/RNG/time state.
Sqrt is IEEE binary64 correctly rounded; no caller epsilon or renderer dependence.

pointInto validates index finite representable long[0,MAX_SAFE] first (INVALID_INDEX),
then index<size (INDEX_OUT_OF_RANGE), then non-null target and offset>=0 and offset+2
within buffer checked without overflow (INVALID_OUTPUT). No partial target write on error.
Only typed long index in this first public surface; do not add aliases/convenience overloads.
Output comparisons: exact sizes/order/error codes and positive-zero representation;
axis-aligned golden values exact. Non-axis coordinates use per-coordinate absolute1e-12
plus relative1e-12 tolerance for fixture comparisons; implementation arithmetic stays fixed.
No guarantee of pointwise exact source Processing floats or pixel identity across renderers.

Distinguishing fixtures: empty points/discs, zero strength with budget still enforced,
inside/on/outside, exact center, fractional movement, two order permutations (2 vs-1.25),
reentry case (1.5 ->2 ->1),3-4-5 direction, subnormal displacement, finite difference/distance
overflow treated outside, final coordinate overflow, invalid-before-work, owned output and
atomic pointInto errors. Java-only implementation first; all other targets deferred.

Next translate this brief into the authoritative catalog and shared fixtures, root review
both, then code. This admission is not catalog freeze or implementation acceptance.

## Numeric review notes before catalog freeze

Axis-aligned exact values: point(3,4), center(0,0),radius10,strength0.5 yields(4.5,6).
Point(MAX,0) against center(-MAX,0),radiusMAX has overflowing displacement and remains
outside; point(MAX,MAX) against center0,radiusMAX has overflowing computed distance
and remains outside. In contrast point(MAX,0) at matching center(MAX,0),radiusMAX
with strength1 takes the positiveX convention and must fail NUMERIC_OVERFLOW.
Subnormal distances can lose relative precision even with scaled norm; golden vectors
must follow stated binary64 operations. Do not infer exact boundary landing for every
representable input, continuous output near exact centers, or exclusion of joined segments.
The planned public workflow is design/capabilities/projection-marks-native-plan.md.

## Root catalog freeze

Authoritative catalog/operations/sequential-disc-projection-2d.json version0.1.0 is reviewed.
15 shared JSON scenarios separate runnable input/output/errors from native-only ownership,
carrier and pointInto checks. Root independently evaluated successful vectors and added
distance overflow alongside subtraction overflow. Array count maxima multiply to
768614334972908886, below signed64 maximum9223372036854775807; draft work-overflow
concern was incorrect and needs no additional error.
Native tests must cover disallowed carriers/nonfinite fields, typed malformed lengths,
LinkedList parity, detached inputs/exports and atomic pointInto failure with negative or
unsafe long index, out-of-range index, null/short output and invalid offset. NaN Object
index is not a supported API and must not become a test-only public overload.
Contract approval remains distinct from implementation/native/distribution acceptance.

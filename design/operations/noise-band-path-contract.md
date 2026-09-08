# NoiseBandPath2D 0.1.0 — normative transition for catalog preparation

Root architecture: design/capabilities/cp15-band-boundary-review.md. Source mechanism:
2018/Generativos/venas#0, with explicit portable noise/RNG divergence. This specification
freezes semantics for the catalog and fixtures; no target implementation is accepted yet.

## Inputs and native surface

One exact record, fields validated in this order:

1. field: exactly {seed:uint32}, existing field.gradient-noise-2d-01@0.1.0 descriptor.
2. start: exactly two finite binary64 coordinates, x then y.
3. heading: finite binary64 radians, no normalization.
4. seed: integer0..4294967295, private walk stream.
5. attempts: integer0..2147483647, counts proposals, including rejected proposals.
6. stepDistance: finite binary64 >=0, coordinate units.
7. fieldScale: finite binary64, including negative and zero.
8. fieldOffset: exactly two finite binary64 field coordinates, x then y.
9. tolerance: finite binary64 >=0, scalar-value units. Strict acceptance; zero accepts none.
10. maxVertices: integer1..1073741823, includes starting vertex. Resource cap, not allocation.

Validate outer shape/exact keys before individual fields. Follow existing six boxed Java
numeric carriers and passive Map/List interchange conventions. Reject booleans, null,
strings and arbitrary Number classes. All static failures are INVALID_INPUT. No defaults,
encouraged artistic ranges, or host field/callback inputs. Limits are representation bounds.
Input -0 values are canonicalized to +0 before computation and detached configuration export.

Java: org.procedurals.paths.NoiseBandPath2D.trace(Object) returns immutable NoiseBandPath2D.
size(), attempts(), accepted(), rejected() are int; size=accepted+1, attempts=accepted+rejected.
pointAt(Object/long) returns new double[2]; pointInto(Object/long,double[],int) writes two
coordinates; headingAt(Object/long) returns the proposal heading for accepted segment i,
connecting point i to point i+1. Zero-distance accepted moves still have one heading.
serialize() returns a detached validated configuration; toValues() returns exactly
{positions:[[x,y],...],headings:[...],attempts,accepted,rejected}. Rejected proposals add
neither a point nor a heading. Return the original start even if there are no acceptances.
No mutable state, shared RNG, drawing, implicit seed layout or incremental execution API.

Access errors: INVALID_INDEX for nonfinite, negative, fractional or >9007199254740991
index; INDEX_OUT_OF_RANGE for a valid index >=size (point) or >=accepted (heading).
pointInto validates index before output; null/insufficient double[] or negative/overflowing
offset gives INVALID_OUTPUT, with no writes. Failed queries leave result usable.

## Arithmetic and RNG

Use precisely the xoshiro128**1.1 uint32-seeded SplitMix64 expansion and U32/2^32 mapping
specified in catalog/operations/seeded-line-pool-2d.json behavior.rng. Private state resets
per trace; no host RNG or source stream compatibility. All outputs compare exactly.
Use fdlibm5.3 binary64 sin/cos as provided by Java StrictMath, with no angle reduction by
caller code. All basic operators round separately to binary64; no FMA/reassociation.
HALF_PI=0x1.921fb54442d18p0; decimal .1 and .2 mean nearest binary64 values.

Every stored coordinate/heading is canonical +0 when equal to zero; canonicalize updated
x/y/heading before they feed the next attempt. Do not canonicalize every temporary value.
Subnormal values and arithmetic underflow are permitted; no flush-to-zero profile.

C(v,stage) raises TRACE_ARITHMETIC_INVALID {attemptIndex,stage} if v is nonfinite.
Q(x,y,prefix) evaluates these separate operations IN ORDER:
 qx=x*fieldScale; validate product finite; qx=qx+offsetX; validate final qx finite and
 -9007199254740991 <= qx < 9007199254740991. Invalid either intermediate or final x
 gives TRACE_QUERY_INVALID {attemptIndex,stage:prefix+"_x"}.
 Then qy=y*fieldScale; validate product finite; qy=qy+offsetY; validate final domain
 similarly with prefix+"_y". The intermediate product need not satisfy the lattice domain.
 Query existing field.sample(qx,qy), whose finite [0,1] output is guaranteed.
The multiply must be checked before addition. Static finite offsets do not rescue overflow.

After static validation, initialize one retained start point and local heading. If attempts=0,
return immediately: no RNG draws, field sample, coordinate transform or trig. Otherwise
attemptIndex=-1; level=Q(startX,startY,"start_query"). Then create the private RNG.

For attemptIndex from0 through attempts-1:
 u0=U(); low=(-HALF_PI)*u0
 u1=U(); high=HALF_PI*u1
 span=high-low
 u2=U(); delta=span*u2; turn=low+delta
 proposal=C(heading+turn,"proposal_heading")
 dx=C(stepDistance*fdlibmCos(proposal),"delta_x")
 nx=C(x+dx,"position_x")
 dy=C(stepDistance*fdlibmSin(proposal),"delta_y")
 ny=C(y+dy,"position_y")
 value=Q(nx,ny,"candidate_query")
 u3=U(); driftProduct=.2*u3; drift=-.1+driftProduct
 rejectionHeading=C(heading+drift,"rejection_heading")
 difference=value-level; bandError=abs(difference)
 if bandError < tolerance:
   if size==maxVertices: fail VERTEX_LIMIT_EXCEEDED {attemptIndex,stage:"append"}
   canonicalize nx,ny,proposal; append point(nx,ny),heading(proposal)
   x=nx; y=ny; heading=proposal; accepted++
 else:
   heading=canonicalize(rejectionHeading); rejected++

Every completed attempt consumes FOUR draws, even if low/high coincide, distance is zero,
tolerance is zero, or the proposal rejects. A dynamic failure stops at the first stated
stage and consumes no later draws. Rejection drift is calculated/validated even on acceptance,
then discarded on acceptance. No retry-until-success loop or early stop for immobile paths.
There is no canvas-boundary handling. Trig and field are evaluated even for zero distance.
The difference of two [0,1] samples cannot overflow. Resource failure is tested only for an
actually accepted append, after candidate query and rejection-heading checks. No partial
result escapes on any failure; host allocation failures remain host errors.

## Storage and validation obligations

O(attempts) work and O(accepted) retained numeric payload,24 bytes per accepted move plus
16-byte starting coordinates, excluding headers/capacity. Grow bounded packed arrays lazily;
do not preallocate maxVertices or store rejected coordinates. No per-attempt object creation.
One attempted query uses existing allocation-free field sampling. Export is explicitly O(size).

Fixtures must distinguish: zero work before unsafe dynamic query, exact zero-tolerance
rejection, constant-field and zero-distance acceptance, accepted-heading overwrite versus
rejected-heading drift, four-draw consumption, a nonconstant mixed accept/reject path,
strict equality at the band threshold, vertex-cap success versus rejection/error, static
carrier/domain errors and initial/candidate query overflow. Core native tests additionally
cover ownership, accessor error precedence and no partial output writes.

Meaningful bounded costs: tiny cases,96x2048 prototype range and1000x10000 source attempt
range, consuming paths one at a time with checksums and reporting accepted/rejected counts.
Do not equate attempt count with retained output or extrapolate a desktop observation.
Native BandMarks must use the public core, include subpixel first segment, preserve path
identity under style edits, demonstrate tolerance change and retained perpendicular-mark
transfer, exact reset and saved-display equality. Actual Processing and extracted source
bundle validation precede Java support; other targets explicitly deferred. No venas
recreation credit until separately demonstrated under the recreation policy.

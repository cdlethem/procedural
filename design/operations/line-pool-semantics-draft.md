# Seeded line-pool growth: semantic draft

Root-owned draft after reviewed topology.branch-subdivide admission. NOT frozen and not a
catalog support claim. Motivating review: design/capabilities/line-pool-admission.md; measured
prototype: evidence/parameter-experiments/line-pool-controls/decision.md.

## Interface and values

Proposed operation topology.seeded-line-pool, eager construction. Required input keys only:
seed(uint32), segment([x0,y0,x1,y1] finite binary64), attempts(nonnegative int32),
firstCutAngleScale(finite nonnegative), minCutLength(finite positive), maxSegments(positive
int32 bounded by packed-array representation). No defaults/encouraged range. maxSegments
is a caller admission cap, not an artistic parameter. It prevents callers approving work
without approving retained output. Do not allocate the full cap in advance.

Result: ordered detached segments, parallel divided booleans, attempts, successfulCuts,
skips. Native access: size(), segmentInto(index,out,offset), segmentAt(index), dividedAt(index),
attempts(), successfulCuts(), skips(), toValues(). No mutable pool handle, iterator, parent
pointer, arbitrary callback, renderer or history. Start segment remains in output even if
zero-length, too short or attempts0; such selections skip. Finite input alone does not
promise arithmetic success on extreme coordinates.

Use established passive-carrier/index validation from CP6. Validate shape, then seed,
segment, attempts, angle, minimum length, cap; malformed values fail INVALID_INPUT before
work. Input snapshot detached; failures never return partial output. RESOURCE/ARITHMETIC
failure must not mutate caller inputs. Exact error detail schema and representational cap
remain fixture-design work; do not copy a neighboring cap for a different storage layout.

## RNG and transition order

Choose package-owned xoshiro128**1.1 with the exact uint32/SplitMix64 initialization and
word transition already specified in seeded-endpoint-branches.json. u=word/2^32. Private
stream per invocation, discarded after result; no Processing/global RNG. This deliberately
changes the prototype's Processing stream. Native reproduction must validate the resulting
idiom again; prototype success is not automatic portable-core acceptance.

Define range(lo,hi): if lo>=hi return lo with no draw; otherwise consume one u and compute
lo + ((hi-lo)*u), binary64 multiply then add. Do not loop to repair upper-end rounding;
this is an explicit difference from Processing's bounded retry. Check finite intermediate
and output values. Selection index uses floor((u0*size)*(.8+.2*u1)), exact ordered multiplies;
if rounding reaches size, clamp only that index to size-1. Clamp is an explicit contract
choice, not a general numeric repair. Two words consumed even for a one-element pool.

At each attempt compute selected dx,dy,heading and length from current endpoints, not a
cached original length. Skip iff length<minCutLength; equality cuts. No other random draws
on skips. For a cutting attempt:

1. Sample lo=range(.6,.7), hi=range(0,.8), fraction=range(lo,hi). If already divided multiply
   fraction by.4. Compute cut=start+((end-start)*fraction) per coordinate. Save old endpoint.
2. If first cut: angle1=(range(0,1.2)*range(.2,1))*firstCutAngleScale, then angle2 likewise.
   Consume the source's unused range interpolation word. Sample three independent length
   factors range(.9,1.2); each new length=(length*(1-fraction))*factor. Sample continuation
   offset range(-.1,.1). Consume selection floor(3*u):0 no append,1 positive then negative
   branch,2 continuation only. Parent becomes divided even if no child is appended.
3. If repeated cut: append continuation(cut,oldEndpoint) flagged divided; sample deviation
   range(.1,.4), then sign(u<.5?-1:+1), multiply deviation*sign*2; sample length factor
   range(.9,1.1). Append angled child flagged undivided. Both branches start at cut.
4. Parent endpoint becomes cut. All fresh ordinary children start undivided. Store append
   order exactly; count one successfulCut even when first cut appends no children.

Before committing a cut, check capacity for the actual chosen append count; no false failure
when selection0 appends nothing. Compute that cut's outputs in local scalars, checking finite
arithmetic, then commit atomically. Do not materialize unused candidate endpoints: unused
RNG draws are retained but unused trig/geometry must not introduce observable failures.
No partial result escapes on any later failure. Attempts=successfulCuts+skips exactly.

## Numeric decision requiring resolution before freeze

Unlike endpoint branching, a future cut's skip decision depends on previously trig-derived
coordinates. A generic coordinate epsilon CANNOT justify differing topology or random words.
Java's first implementation can use StrictMath for atan2/sin/cos/sqrt plus explicitly ordered
binary64 dx*dx+dy*dy, checking overflow before sqrt. However cross-target exactness requires
a shared specified elementary-math implementation or a proven equivalent strategy, not a
promise that arbitrary host math libraries agree. Do not silently add a tolerance to the
minCutLength test or switch to nominal lengths: both change the admitted computation.

Next decision must compare cost of specified reproducible elementary math versus a versioned
Java-only numeric capability with other ports explicitly unclaimed. The roadmap still requires
later ports; a Java-only label does not discharge that obligation. No catalog entry or fixture
freeze until this choice and arithmetic failure order are explicit.

## Distinguishing fixtures to prepare

Small vectors must demonstrate: zero work; zero/short/equal-threshold segment; first-cut
selection0/1/2; revisit continuation flag; reversed bounds consuming no third word; unused
source word retained; tail of RNG stream after skipped work; actual-append cap failure versus
zero-append at cap; finite-coordinate overflow; detached getters and atomic failed writes.
Use injected/internal word-stream oracles only in diagnostics, not a public RNG callback.
Record exact topology, state/counters and source indices. Large golden render hashes cannot
substitute for these fixtures. Root must inspect an independent second stroke/seed and
full30-pool workload before final capability acceptance.

## Numeric issue resolved

The numeric-decision section above is superseded by line-pool-numeric-decision.md:
reproducible fdlibm5.3 trig/atan2 plus correctly rounded sqrt, Java StrictMath first;
other targets deferred pending exact implementation. Error/storage order is specified there.

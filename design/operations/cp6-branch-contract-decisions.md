# CP6 endpoint-branch contract decisions

Root's drafting instructions, not a second schema or an implementation approval. The
catalog will be authoritative after contract and fixture review. The dependency
`topology.seeded-endpoint-branches-2d` passes the Phase 2 prerequisite check. Source
distinctions and the artist-facing decision are in cp6-branching-selection.md; root's
freshly rerun ordering acceptance is in evidence/investigations/cp6-growth-prefix-review.json.

## Artist entry point and retained result

Select one `BranchTree2D.generate(Object)` factory in `org.procedurals.topology`.
The artist supplies a root and a sequence of generation rules, then draws retained
segments. Repeating a rule gives fixed spread; constructing different turn intervals
per generation gives changing spread. Rule sequence length is the number of possible
growth transitions, not a second configurable depth. An empty sequence returns the root
segment alone. A parent with no successful slots is a terminal even before the last rule.

The exact required input keys are `seed`, `root`, `rules`, `maxSegments`. Root has exact
keys `origin` (ordered x,y pair), `heading` (radians), and `length` (coordinate units).
Each rule has exact keys `lengthScale` (ordered closed nonnegative interval) and `slots`
(ordered list). Each slot has exact keys `probability` (closed [0,1]) and `turn` (ordered
closed interval in radians relative to its parent's heading). All scalars are finite
binary64, except seed and maxSegments which are integral. No optional values or defaults.
Reject extra keys, booleans and non-finite values. Follow CP5 passive Map/List and ordinary
numeric carrier conventions; no arrays, PVector, callbacks or arbitrary Number subclasses.

Root origin and heading may be any finite value. Root length and scale endpoints may be
zero or exceed one; shrinking is an example choice, not the general mathematical domain.
Accept coincident endpoints and zero-length branches while retaining their heading,
nominal length and ancestry. Heading is never normalized. Coordinates use x right/y down,
so a positive turn appears clockwise in a conventional screen drawing.

Retain six binary64 values per segment: start x/y, end x/y, heading and nominal length.
Also retain parent index, generation and actual direct child count as integers. Root has
parent -1 and generation 0. Nominal length matters for taper without a hypot reconstruction
that can underflow or overflow; heading preserves orientation when geometry collapses.
No styles, seed/config echo, IDs, implicit terminal mark or reconstructed tree is retained.

Materialized output keys are `segments` (ordered [x0,y0,x1,y1] rows), `headings`, `lengths`,
`parents`, `generations`, `childCounts`, all of equal length. Java exposes size(),
segmentAt(Object|long), segmentInto(Object|long,double[],int), headingAt(Object|long),
lengthAt(Object|long), parentAt(Object|long), generationAt(Object|long),
childCountAt(Object|long), and toValues(). Fresh detached arrays/plain values; immutable
owned internal storage and no per-segment allocation in the drawing loop. Use existing
INVALID_INDEX then INDEX_OUT_OF_RANGE then INVALID_OUTPUT precedence; buffer writes atomic.

## Exact traversal and private stream

Use the existing xoshiro128**1.1 uint32 seed, two SplitMix64 expansion and uint32/2^32
unit mapping already specified in seeded-triangle-points. The contract must state the
algorithm, not make the other operation a runtime dependency. Seed range is [0,4294967295].
No returned RNG state or host global RNG; fixtures observe stream progression separately.

After complete input validation, append the root. Visit parents by increasing retained
index. If generation is outside rules, consume no draws. Otherwise consume one unit for
the rule's shared per-parent scale, including empty slot lists. For each slot in order,
consume one gate unit even at probability 0 or 1. A slot succeeds iff unit < probability.
Failure consumes no angle. On success, check maxSegments before another draw or child
arithmetic; consume one angle unit, compute child attributes and append it immediately.
Only after successful append increment the parent's child count. Visit children later
through the same growing list, never recursive descent.

All siblings of a parent share the sampled scale. Multiply parent length by that scale
only for successful children: a hypothetical overflowing length must not fail a tree
whose slots all failed. Constant scale and turn intervals still consume their units.
No unused terminal shrink or invisible colour draws from the source are preserved.

With identical root, seed and existing rules, appending rules preserves geometry,
heading, length, parent and generation for all previous nodes when both calls succeed.
Existing child counts may increase; terminal membership and whole output are not prefixes.
Changing a late rule preserves earlier levels. Changing gates/slot count in an early rule
may shift subsequent stream consumption: no general locality promise beyond these cases.

## Numerics, errors and bounded work

Canonicalize input/output zero to +0. Sample intervals using the endpoint-aware clamped
binary64 interpolation selected for CP5: endpoint branches first; strictly opposite-sign
weighted sum otherwise a+(b-a)*t; clamp to endpoint interval, canonicalize zero. State the
full law in the catalog. No FMA, reassociation or binary32 intermediates.

For a successful child, after its angle draw, compute length = parent.length * scale,
then heading = parent.heading + turn. Its origin is the exact retained parent endpoint.
For every segment compute dx = cos(heading)*length, dy = sin(heading)*length, then
endX = startX+dx and endY = startY+dy, as separate binary64 operations. Check finiteness
after each of length, heading, dx, dy, endX, endY in that order (root length/heading were
already validated). Arithmetic failure raises BRANCH_ARITHMETIC_INVALID, with parentIndex,
slotIndex and stage in that fixed vocabulary. Root uses parentIndex=-1, slotIndex=-1.
No partial tree is returned. Host allocation failure remains a host exception.

Use host binary64 sin/cos with same-runtime replay, following GradientPath's policy.
Do not promise cross-runtime trigonometric bits. Fixture topology, RNG words, headings
and nominal lengths compare exactly; coordinate expectations carry explicit case-specific
tolerances for nontrivial trigonometry. Exact zero-heading axis fixtures, arithmetic
adversaries and dynamic errors remain exact where no trig approximation is involved.
Huge-heading and overflow boundaries need explicit tests and portability limitations;
do not loosen all coordinates with one global epsilon.

Static validation order: outer keys, seed, root keys/origin x/y/heading/length, rules
outer carrier, each rule keys/scale endpoints/slots carrier then slot keys/probability/
turn endpoints in list order, finally maxSegments. Validate even unreachable later rules
before root computation, output storage or RNG. Static errors use INVALID_INPUT.

maxSegments is an explicit integer [1,357913941], including the root. The upper bound
comes from six scalar slots under signed-32-bit indexing, not observed artistic usefulness
or an allocation guarantee. On a successful slot at capacity, raise SEGMENT_LIMIT_EXCEEDED
with parentIndex and slotIndex, before its angle draw or arithmetic. A root-only tree at
capacity succeeds; failed gates at capacity do not fail. Never silently truncate.

Work is O(input rule/slot data + visited slots + emitted nodes); memory is O(input rule
data + emitted nodes). maxSegments bounds retained nodes, not all input validation or
slot visits. Document this honestly; do not describe it as a total runtime budget. Use
growable packed storage, without preallocating maxSegments or per-node objects. Retained
primitive payload is 60 bytes/node (6 doubles and 3 int32 values), excluding array headers,
capacity slack, input data and temporary materialization. Benchmarks must measure realistic
rules and both branching and a long one-slot chain; no host recursion.

## Evidence and release obligations

Source arbolito3/arbolito4 motivates ordered probabilistic endpoint children, shared child
length, generation-specific angles and terminal styling. BFS, a private portable stream,
uniform scale intervals, explicit rule data, representation limits and collapse policy
are design decisions, not source equivalence. Source nested shrink distributions and DFS
colour draw schedules differ. Private diagnostic Java Random outputs are not golden
vectors for this public RNG. Source measured depth/spread edits establish impact but no
universal recommended ranges. Keep parameter observations separate from chosen example
settings and hard domains; no new encouraged range or default is approved.

Required fixtures distinguish BFS from DFS, independent gates from whole-node gating,
shared from per-child scale, conditional angle draws, constant-interval draws, terminal
no-draw behavior, empty slots, prefix/late edits, zero lengths and collapse, invalid unused
rules, capacity-before-angle/arithmetic errors, all arithmetic stages, detached access and
atomic output writes. Reuse shared seed expansion vectors, and include public-RNG stream
traces. Root must review the catalog and distinguishing fixtures before Java code.

Java is first. Other targets remain unimplemented/unvalidated. An editable BranchMarks
starter must expose seed, appended rules, spread, style reuse, actual terminal marks and
transfer to CP3 placed roots. It must be installed and rendered before a workflow delivery
claim. Retained geometry and nominal length keep the drawing loop straightforward.

The intended Java composition below is a usage sketch, not runnable implementation.
`record` and `pair` are the same small example-local Map/List construction helpers used
by GrainComposition; they do not become public library operations. These spread,
probabilities, scale and cap values are example settings, not library defaults or
recommended ranges. Constructing rules does not require writing the expansion algorithm:

```java
List<Object> rules = new ArrayList<Object>();
for (int generation = 0; generation < 7; generation++) {
    double spread = 0.5; // Replace with a per-generation expression for changing spread.
    rules.add(record("lengthScale", pair(0.65, 0.85), "slots", Arrays.asList(
        record("probability", 0.7, "turn", pair(-spread, -0.5 * spread)),
        record("probability", 0.7, "turn", pair(0.5 * spread, spread)),
        record("probability", 0.4, "turn", pair(-0.2 * spread, 0.2 * spread)))));
}
BranchTree2D tree = BranchTree2D.generate(record("seed", 42,
    "root", record("origin", pair(320, 590), "heading", -Math.PI / 2, "length", 100),
    "rules", rules, "maxSegments", 5000));
double[] segment = new double[4];
for (int i = 0; i < tree.size(); i++) {
    tree.segmentInto(i, segment, 0);
    // Choose line weight from tree.lengthAt(i), colour from tree.generationAt(i),
    // and a terminal mark when tree.childCountAt(i) == 0; then draw segment.
}
```

Keep existing rule values unchanged when appending generations: a spread expression that
also depends on the total rule count changes earlier rules and forfeits the prefix promise.
The starter's depth control must append/remove an existing fixed rule schedule, rather
than silently renormalizing every generation's spread by the new total count.

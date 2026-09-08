# Mutable line-pool branching: root direction

Status: bounded prototype justified; no public signature, defaults or ranges approved.
Artist task: take initial strokes, repeatedly cut existing segments and grow new strokes
at those cuts, then restyle the retained pool. This differs from endpoint ancestry in CP6.
Motivation: survey/out/2019/generativos/brotes/notes.md and exact pinned source reviewed in
branching-evidence-audit.md. No completed source parameter trials exist.

## Resolved host ambiguity

Processing4.5.6 PApplet.random(low,high) returns low immediately when low>=high; it does
not sort bounds and does not consume the third draw. Root inspected local runtime bytecode
and ran .work/diagnostics/line-pool/RandomBounds.java against that actual core JAR.
Seed42,100000 nested-bound samples:81046 reversed/equal, min cut0.6,max0.79974914.
The diagnostic also checks subsequent RNG equality against a control after reversed bounds.
This is host-semantic evidence, not visual parameter evidence or a general probability bound.

Thus the first source cut is a mixture, heavily concentrated in [.6,.7), with occasional
interpolation toward an upper value below.8. A plain uniform cut, sorted bounds or always
consuming a third draw cannot claim source replay. The divided-line cut multiplies this
same sampled fraction by.4. Preserve this behavior in a source-faithful private prototype.

## Candidate boundary to test before contracting

A bounded construction returns final ordered segment endpoints and divided flags; it does
not return a tree whose parent geometry is immutable. A stable segment identifier may be
its append index, but final endpoints can change on later selections. A trace/history is
not required for drawing and should not be retained by default. One invocation operates
on one pool; the source's30 calls are independent pools, not a single interacting forest.

Prototype source transitions first, with explicit attempt budget and seed segment. Keep
source distributions private while deciding which controls have demonstrable independent
value. Do not expose the entire accidental source policy as a parameter object. Intended
questions: does angular spread deserve a direct control; does more attempted work reliably
change useful density, or just select already-short segments? Record attempts, successful
cuts, short-line skips, output count and construction time. At most two segments append per
successful attempt, so capacity can be bounded by1+2*attempts before allocation.

First implementation experiment can compare source90000 attempts to9000 and angular spread
1.4 to.7, keeping seed, initial stroke, renderer and style fixed. These are investigation
values, not proposed defaults or encouraged ranges. Write the parameter-evidence experiment
brief and decision rules before rendering; use the repository candidate path and preserve
all failures. A single initial stroke isolates growth; later30-pool source-range validation
is required before any whole-brotes recreation claim.

Admission requires visible, useful control changes plus a compact interface that retains
mutable-cut semantics without forcing caller reimplementation. If that fails, defer this
operation rather than add a policy callback or general grammar framework. Native capability
is line/dot drawing with optional additive style, kept outside the numeric core. No general
L-system engine or full physics capability is implied by the report's technique labels.

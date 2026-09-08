# CP6 architect decision: grow a retained branching structure

Status: root-selected endpoint-branching investigation. This selects a capability and a
private comparison, not a frozen public signature, candidate merge or implementation contract.
Sol remains paused. Root owns the operation boundary; bounded agents retrieve evidence or
implement the specified private comparison. Java is the first delivery target.

## What an artist should be able to do

Start with one upward-growing stem. Change its number of generations and its child directions;
retain the resulting segments and draw them as thin lines, tapered limbs or terminal dots.
Then plant several independent structures at positions supplied by an existing placement
operation. This removes recursive expansion, stopping, parent bookkeeping and retained
geometry storage from the artist's drawing loop. It does not choose a forest composition,
leaf style, palette, lighting or biological growth model.

The delivered value must include ancestry and generation, not merely an anonymous list of
lines. An artist should be able to colour by generation, identify terminal segments including
branches that died early, and attach new marks without reconstructing a tree from coincident
coordinates. Indexed traversal should reuse caller buffers. These are design requirements,
not a claim that the original sources already return a topology object.

## Selected boundary to investigate

Investigate a seeded endpoint expansion with ordered child slots. Each slot controls whether
a child exists and its angle relative to its parent. Root pose/length and generation rules
are explicit. Child lengths belong to geometry; rendered width and terminal decoration stay
in ordinary example drawing. A generation-dependent rule table is a candidate for expressing
changing spread and scale without hard-coding one botanical silhouette. Compare its cost
with a short fixed-rule convenience before admitting either to the public API.

`arbolito4` is the decisive computation: emit one segment, try left/right/middle child slots
in order, and recursively expand successful children from its endpoint. Its active gates
permit zero through three children. Root independently read its source and the exact audit
in [cp6-arbolito4-source-audit.md](cp6-arbolito4-source-audit.md). Choosing explicit slot rules
rather than a source-named tree mode is a design generalization to test in the working piece.

Do not merge all recursive sketches into that rule. `Arboles` first gates a whole node and
then chooses a child count and fan; independent slot gates are not the same probability law.
Its existing keep record remains evidence for another expansion policy, not proof that a
slot-based operation implements the whole helper. Likewise the 2019 mutable brotes line pool
changes existing parent endpoints; it stays a distinct future state-machine investigation.
No family is rejected because it is outside this first capability.

## Corrections established by root's source reading

- In `Arboles`, the angle is incremented by `desang` before the child fan. The length law
  `map(remaining,2,8,1,0.70)` is 1 at remaining2 and 1.05 at remaining1. Therefore the final
  child length can increase; a blanket shrinking-only constraint would not represent it.
- In `arbolito4`, `v=remaining/total` is computed before decrement and used by
  `lerp(ea*0.3,ea,v)`. The root has the widest angle range; later generations narrow it.
  All successful siblings inherit the same sampled shortened length from their parent.
  Terminal calls still consume the two shrink draws before stopping. The notes reverse
  the spread trend and overstate the minimum child count.
- Root also inspected pinned `2020/generative/05_08/brotes/brotes.pde`, lines62–117, against
  its note. Depth is an integer: entry decrements it by1, and a child receives
  `ite-int(random(1.1))`, subtracting a further0 or1. It is not fractional depth decay.
  Interior attachment is real, but it does not justify a noninteger-depth API. The unusual
  nested random child-count law needs host-bound evaluation before any source-law claim.

All source readings use upstream revision69bdd8513e4482a5e6018e36887d4bc208660eb5 through
`git show` in the local provenance checkout. No upstream implementation is copied.

## Alternatives and exclusions

A single segment-rotation helper leaves recursion, termination and ancestry to every caller;
it would not remove the difficult part of this task. A generic callback growth engine would
make random consumption, errors and portability depend on opaque host code too early.
A string-rewriting L-system plus turtle interpreter could enable another useful workflow,
but direct recursive trees do not by themselves establish symbolic rewriting evidence.
The bounded neighbour retrieval must identify any actual rewriting examples before that
family is admitted or rejected.

Endpoint-only attachment is initially explicit. Do not silently add interior cuts, graph
cycles, obstacle avoidance, space colonization, collision claims or mutable growth animation.
Placement may arrange root positions; it does not guarantee nonoverlapping canopies.
No guarantee of finite total work can depend only on small depth: fanout grows exponentially.
The eventual contract needs explicit bounded work, iterative traversal rather than unbounded
host stack recursion, defined output ordering, and an honest limit-exhaustion policy.

## Private comparison before public contracts

Use one supplied root, fixed independent seed, bounded total segments and a small rule set.
Compare fixed versus generation-dependent angular spread, shallower versus deeper expansion,
and a narrower spread. Retain one result for width/terminal-mark changes. Transfer the same
kernel to roots provided by the existing circle-placement operation at smaller scale.

Before accepting a public parameter, separate its computation semantics from any recommended
range. Source depth/spread experiments show visible effects, but the depth edit changes shared
RNG consumption for later siblings and roots. No continuous recommended range is established.
Public geometry/style independence will be a deliberate source divergence. The comparison
must show that a small rule description is actually useful, not merely that it is expressive.

After the comparison, root must choose shared-versus-per-child length draws, slot/descendant
RNG order, generation semantics, work-limit errors, output ancestry/terminal representation,
and trigonometric policy in one reviewed contract. Use the existing path contract's honest
same-runtime replay/cross-target tolerance approach if host sine/cosine are selected; do not
promise universal exact trig bits. No catalog entry is ready yet.

## Bounded prototype work, checked before execution

With eight emitted generations and at most three children per segment, a fully occupied
comparison tree has at most (3^8-1)/2 = 3280 segments. The six-generation case has364;
the eight-generation binary case has255. Each five-generation transfer tree has at most121,
and ten accepted placements would therefore have at most1210. The five distinct authored
trees plus transfer total at most11669 generated segments; reusing the baseline for two
style images makes at most18229 drawn segments. The private5000-per-tree/30000-total guards
are conservative work ceilings, not measured useful ranges. These bounds depend on the
fixed prototype generation/fanout settings and are not a future public API size promise.

A public result should make actual terminal segments observable, including early death when
all child gates fail. A terminal marker attached only to the final allowed generation would
miss this important artist edit. Topology checks must distinguish those cases. Output order
and recorded parent indices must also make replay independent of coordinate coincidence:
zero-length or rounded-coincident endpoints cannot be used to infer ancestry.

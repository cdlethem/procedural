# CP11 architecture decision: retained occupied lattice paths

Root approves this capability for a provisional contract design, not implementation
or a support claim. The scoped evidence is cp11-lattice-evidence.md; root independently
read both parent reports and decisive source loops. Java first; no rendering in this
selection batch. One operation and one example are the intended maximum scope.

## Chosen computation and artist value

Generate ordered orthogonal paths on a rectangular integer lattice with one shared
occupancy set. Input supplies the ordered starts, dimensions, a maximum number of
successful moves per path and an explicit portable seed/state. Return retained paths,
per-path completion reason and final random state. Coordinates remain integer cells;
RegularGrid or visible example arithmetic maps them into drawing coordinates.

A successfully claimed start is emitted and occupied immediately. A start already
occupied by an earlier path produces an empty path with occupied-start reason and
consumes no randomness. This is a valid sequential placement outcome, not malformed
input. Starts outside the grid are invalid input. Empty start lists are valid.

At each step enumerate in-bounds unoccupied neighbours in fixed north/east/south/west
order. Uniformly select one available neighbour using the existing portable random
primitive and its specified consumption, append it, and mark it occupied. When no
neighbour exists, stop with blocked reason without consuming a random choice. Reaching
maxSteps gives step-limit reason; maxSteps0 still emits and reserves an available start.
A zero step limit is checked before looking for neighbours. The contract must freeze
random selection including the one-neighbour case, not leave it to implementations.

Complete static validation and representational/work checks precede generation. Owned
output and occupancy are local to a call; no global canvas, renderer, callback, clock,
mutable session or retained trail system. Batch ordering is observable. Every emitted
cell belongs to at most one path, and consecutive vertices differ by one cardinal step.
Output length may be short; completion reasons explain why. Do not claim a maze solver,
maximal packing, shortest routing, guaranteed coverage or guaranteed requested lengths.

## Explicit design differences from the evidence

Tata is the motivating occupied-destination mechanism. Its shared used[][] belongs to
the arrangement, not individual paths. This decision preserves that shared occupancy
and its influence on later paths, while changing start and proposal policies:

- Include/reserve the start, so artists receive a complete connected path and occupancy
  means all returned vertices, without an invisible initial anchor.
- Enumerate available neighbours rather than making four random proposals with replacement.
  A reported blockage therefore means geometrically blocked, not unlucky proposals.
- Count successful moves and stop at blockage rather than repeating failed rounds.
- Supply ordered starts explicitly and isolate structural randomness from style randomness.

These are independently specified design improvements, not a claim of equivalent source
output or random consumption. Technique acceptance must demonstrate occupied orthogonal
paths and meaningful length/density changes, not source pixel identity. Source observations
support the value of count/length controls; their exact measured magnitudes do not transfer
to this changed algorithm. No defaults or encouraged continuous ranges are approved.

Guagua's unrestricted revisiting walk is not merged into this operation. It remains a
separate deferred candidate; preserving its unused occupancy allocation would be a mistake.
Tata's shadow/highlight/endpoint helper remains ordinary example drawing here. Neither
stroke settings nor masked disc/stipple decoration probabilities enter this operation.

## Implementation and acceptance scope

Prefer sparse occupancy proportional to visited output, not allocation of an enormous
whole lattice merely because dimensions are representable. Freeze exact dimension/index
limits, maximum output/work semantics, portable integer addressing, overflow precedence,
seed consumption and native access surface before code. Reuse existing RNG and retained
geometry conventions; introduce no graph framework or new benchmark runner.

Minimal semantic scenarios: complete start/zero steps, boundary-limited walk, occupied
start due to earlier path, actual blockage, multiple paths sharing occupancy, seeded
replay/continuation, and malformed/over-budget atomic failure. These should expose likely
wrong behaviours; case count is not a goal. The eventual example must change structural
limits and retain the same geometry while changing strokes or replacing lines with marks.

Next: Terra drafts one concise contract proposal against this fixed semantic direction;
root reviews it once and records exact candidate admission/remainder accounting before
catalog freeze. No implementation task starts from an unresolved draft. Full project
scope, deferred rare families and target ports remain on the roadmap.

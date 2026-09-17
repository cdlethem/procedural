# Draw relationships and responsive trails

Root decision, 2026-09-17: admit two independently designed p5 operations for the first
narrow B slice of [the expansion plan](../../docs/external-art-p5-expansion-plan.md).
No Processing candidate is reassigned or claimed equivalent.

## Artist task and boundary

An artist can change the sensing distance of a moving point network independently from
its attraction, short-range avoidance and marks. Before this slice, the package has paths
and independent target springs but no radius-neighbor enumeration or pair response. A
sketch would otherwise hide its own search and multi-agent step. Existing target springs
cannot express reciprocal interactions evaluated synchronously from one prior state.

`spatial.radius-pairs-2d` returns index pairs for a supplied finite point array and inclusive
radius. A deterministic sorted-x sweep avoids testing pairs outside the x window, without
introducing bin scale, grid-index overflow or a persistent spatial-index object. Output is
lexicographic by original indices. Those indices are stable only while callers retain the
same identities/order. Insertion, deletion and cross-array identity reconciliation are out.

`motion.pair-force-step-2d` consumes supplied positions, velocities and canonical pairs,
sums a declared reciprocal attraction/repulsion law, then advances every body from the old
state. It returns detached positions, velocities and forces. The query is deliberately
separate: a retained graph can replace the radius graph without rewriting the step.

An all-pairs loop remains an independent correctness oracle, not the example's hidden
engine. Ordinary p5 drawing, palette choice and bounded trajectory recording remain in
examples. No callback embeds missing physics. No boundary, collision, sensor-motor wiring,
flocking alignment, contact-age state, physical springs, growth or graph editing is admitted.

## Evidence and limits

Motivating external records are `casey-reas-recjrha9odoj8kk9v` (Process 18) and
`casey-reas-recrvd9by1oqimfxm` (Tissue), in the bound September corpus
SHA256 `c25caa8edf07e11bf1f97cc5a1d70dd65a915620992bc0b3d3746c80ae59d209`.
Root inspected their original catalogue images with SHA256
`9f964b67c8baa6683b46c258012bcecd77fcf944d4ff3f4f1c557194eddbc80b`
and `e2382d814bfa06fa82f33fd017703a98b5881bab1e6b38bcea6f722e54d8bfae`.
See [Process 18](https://index.reas.com/work?id=recjrha9ODOJ8kk9v) and
[Tissue](https://index.reas.com/work?id=recrVD9BY1OqiMFXM).

These motivate responding elements and relationship drawing, not the chosen force law.
Process 18 retains relationship opacity after elements separate; this first slice does not.
Tissue uses environmental points and sensor-motor behavior, not reciprocal pair forces.
Both remain unsupported as complete recreations. The new studies are original design tests;
no original is newly demonstrated or automatically counted plausibly recreated.

## Edits, transfer and resource cost

Change query radius to change graph connectivity; change repulsion strength/radius to change
crowding; change palette/marks without changing state. Damping is a per-call velocity
multiplier after acceleration and before position update. Zero damping stops movement,
a deliberate difference from existing target-spring update order. It is not time-normalized.
Coincident pairs exert zero force because they have no geometric direction: no random or
index-directed separation is invented. Seeded initial conditions belong to the example.

Withhold a fixed-edge open glyph/chain graph until after the interface is frozen. Replace
the proximity query with that graph and keep the same force implementation; this tests a
substitution beyond simply changing colors. It is a design transfer, not an artist recreation.

Two functions add plain point/index/state arrays and explicit physical-style coefficients,
without a scene framework. Query work is O(N log N + C + K log K) and storage O(N+K), where
C is the number of x-window candidate pairs and K the accepted pairs. A vertical sparse
arrangement can still be quadratic; rotating inputs can change work budget consumption.
Step work/storage is O(N+P). Caller budgets cap candidate/step events, not sorting or static
validation. Examples cap agent count and recorded ticks. No public defaults/recommended
ranges are inferred from reference images; finite-domain limits and budgets are design rules.

## Acceptance and deferred work

Fixtures cover inclusive distances, duplicates, zero radius, negative coordinates, finite
extremes, work exhaustion, pair ordering, synchronous state, symmetric forces, no neighbors,
coincidence, speed caps, damping zero, overflow and detached ownership. Brute-force comparison
must challenge the sweep with horizontal, vertical, clustered and randomized data.
Native checks inspect startup/intermediate/later logical ticks, edits, reset/reload/save,
replay and fixed-graph transfer. Root inspects actual images and reviews core code. Browser
performance covers tiny, study and stress workloads and explicitly records dense worst cases.

Public contracts are frozen separately before code. Other targets, persistent contact
history, source-specific behaviors, the rest of B, and C–I remain later bounded work.
No deployment or web application study integration is part of this package batch.

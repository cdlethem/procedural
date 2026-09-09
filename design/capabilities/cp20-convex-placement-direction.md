# CP20 investigation: pack supplied noncircular outlines

Status: private feasibility investigation; no public signature or admission yet. Root owns
architecture/acceptance; Terra owns one private Java prototype. Java0.22 remains the
22-operation accepted package. Ports and Sol remain paused.

## Artist task and boundary

Arrange rotated elongated marks with clearance determined by their outlines, then change
aspect ratio or replace capsules with angular tiles without rewriting overlap rejection.
Circle placements cannot express the directional space occupied by a long thin mark.
A bounding circle rejects useful neighbors; a circle-sized center threshold can admit
intersecting ends. Existing Delaunay topology is a different computation.

Investigate an ordered filter over supplied strictly convex polygons, returning retained
original proposal indices and owned geometry. This follows the existing explicit circle
filter composition: generation and style remain caller decisions. No shape-factory callback,
capsule-specific random distribution, decoration payload or renderer in the operation.
Touching counts as intersection; containment must work in both directions. Reject later
intersecting proposals. Either winding should work. Exact geometric signs on supplied
binary64 coordinates avoid an unexplained epsilon or coordinate-dependent contact tolerance.

These are proposed design choices, not source-compatibility claims. Strict convexity is a
useful bounded first surface for the observed quadrilaterals and rounded convex outlines;
concave polygons, holes, polygon Boolean operations and nesting policy remain unsupported.
A convexity check must reject star traversal, not just inspect local turn signs.
No new public seeded convenience is justified before a complete example shows its need.

## Decisive evidence and contradictions

Root read both complete reports and main/poly tabs at upstream MIT-licensed revision
`69bdd8513e4482a5e6018e36887d4bc208660eb5`:

- `2017/Generativos/celular`, candidate#0 `packNonOverlappingCapsules`: rejection against
  four-vertex oriented quads. Drawing is an overlapping ellipse chain with changing palette
  position. Thickness changes both marks and collision geometry. Its note reports large
  changes for0.8→0.2 thickness and600→200 maximum length, but these are coupled composition
  experiments, not parameter ranges for a supplied-polygon filter. The source never applies
  its seed. Candidate#1 drawing can be ordinary retained-segment stamping; candidate#2 has
  an existing cyclic palette counterpart, but no ledger merge is inferred here.
- `2017/Generativos/celular2`, candidate#0 `packCapsules` and#1 `polyPoly`:12-vertex collision
  outlines and20-vertex drawn outlines, each built around two segment endpoints. No parameter
  experiments. The proposal length also multiplies by `random(0.2,1)`, omitted by the note.
  Drawing a different polygon than the collision polygon prevents a blanket visible-disjoint
  claim. A new workflow should draw the retained collision outline when asserting disjointness.

Both poly tabs are identical. `polyPoly(new, kept)` checks edges and only whether kept[0]
is inside new. It never checks whether new is inside kept. Root compiled the original helper
in a private source-audit harness: a square[2,3] proposed inside kept square[0,10] returns
false; reversing arguments returns true. This explains how nested small forms can be accepted.
The reports' generic no-overlap descriptions are too strong. Parallel/collinear edge division
and strict ray crossing introduce further boundary weaknesses; do not copy this helper.

Source SHA256:

| tab | SHA256 |
|---|---|
| celular/celular.pde | 6a79249ba59afb345b6deb51cfefa61074d07340abcc8017bdd569221f9789f4 |
| celular2/celular2.pde | 8ac55a6b8eaf1da1264ed888bdfb82da4ec56457da125ad6f3516e7acdf525e2 |
| both poly.pde tabs | 5f134e4c696d7bb5e35cf020a863938486ea117990a4a5c46910b4e2dcc34655 |

Private audit: `.work/cp20-source-audit1/result.json`. Original source and compiled classes
stay ignored; proposed implementation is independent. Upstream provenance is preserved here.

## Marginal coverage and alternatives

Before: neither original's ordered polygon rejection is supplied by the library. Existing
circle packing covers circular proposals, including the broad constraint described by
`2019/generativos/espo#2`; it does not need another physics operation. The Forms001/002/003
reports describe static image stamping and disabled collision tests, not missing motion.
Root also checked Forms001 source: its y expression is nested random, contradicting the
report's uniform/bottom-biased simplifications. Do not reuse those claims as sampling bounds.

Projected gain: a deliberate non-nesting structural interpretation of celular becomes
plausible with supplied quads, palette sampling and ordinary dot-chain drawing. A faithful
celular2 recreation is NOT unlocked by fixing containment: nested shapes can be a defining
part of its source result. Neither whole original is currently demonstrated by this work.

Transfer design test: replace rounded elongated outlines with rotated diamonds while keeping
the same filter and source-index style join. It is a design test, not surveyed coverage.
Cost: a polygon input/result concept, strict geometry validation, robust intersection and
quadratic worst-case retained-pair work. Prototype performance must justify the approach;
reuse existing exact orientation infrastructure if suitable rather than introducing a
second unreviewed numerical algorithm. No broad polygon toolkit is implied.

## Bounded deliverables and stopping conditions

1. Root source audit and direction (this document); Luna's bounded contrasting report read.
2. Terra private `tools/diagnostics/cp20/ConvexStudy.java`: symmetric containment, crossing
   edges without contained vertices, touching, winding reversal, invalid convexity and
   difficult finite coordinates;500-proposal4/12-vertex timing. No public API/catalog edits.
3. Root reviews semantic feasibility and numerical/performance costs. Only then schedule
   at most four native JAVA2D study renders through the existing helper/shared lease,
   demonstrating aspect-ratio edits and diamond transfer. Write the experiment brief first.
4. Admit a frozen language-neutral contract, revise the boundary, or explicitly defer.
   No source snippet reuse, recommended parameter range, release or reproduction acceptance
   follows from a passing private prototype. Keep baseline usable throughout.

## Root decision after private study

Proceed to contract design for ordered strictly-convex polygon filtering. Three actual
JAVA2D studies passed and were inspected: broad rounded outlines, thin dashes and diamond
transfer. Evidence: evidence/parameter-experiments/cp20-convex-placement/review.json. Root
corrected silent invalid-input skipping, added missing extreme-coordinate/workload checks
and inspected true star rejection. The source containment asymmetry was executed separately.

The prototype is deliberately not production code: exact BigDecimal signs establish a
reference, but repeated allocations and quadratic geometry validation need explicit work
bounds and representative production benchmarks. Delaunay already has a certified orientation
filter/exact dyadic fallback; decide how to reuse its mechanism privately before introducing
another implementation. Do not change the accepted triangulator merely for code cleanup.

Next freeze normalization, convexity/contact/order rules, error precedence, immutable result
ownership/source indices, arithmetic guarantees and work bounds. Admission to the ledger and
shared catalog follows the existing contract workflow; this document alone does not make
a candidate accepted or count a23rd operation. No seeded convenience, concave support or
source nesting mode is admitted. Root remains final integration owner.

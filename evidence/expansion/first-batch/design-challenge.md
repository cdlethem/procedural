# First narrow B: independent boundary challenge

2026-09-17. Read-only review of root's proposed freeze in
`.work/expansion-first/proposed-neighbor-contract.md`. This is advice to root, not
an admission, contract approval, implementation review or acceptance record.

## Recommendation

Proceed with the two proposed independently specified operations after clarifying
the points below. A radius-pair query and synchronous response to a supplied pair
graph remove distinct burdens. The query is reusable for drawing relationships
without motion; the step can consume fixed or externally selected edges without
a spatial search. Keep contact persistence deferred for the declared original
instantaneous-network and trail studies. Do not hide a persistent-pair engine in
those examples or call trail accumulation persistent relationship state.

Root's replacement of uniform bins with an x sweep is reasonable. It avoids grid
coordinate division, integer cell overflow, ambiguous negative-cell flooring and
rounding-driven missed adjacent cells. It does not promise generally linear local
search: a vertically separated set with identical x can still cost quadratic work.
The explicit candidate budget makes this acceptable for a first bounded slice.

The proposed attraction/repulsion law is coherent, including its zero response
at coincidence. It is an authored law, not extracted Reas behavior. For an isolated
pair inside repulsionRadius R, attraction a and repulsion b balance at
`d = b/(a+b/R)` when the denominator is positive. Thus independent controls have
a useful visible interpretation. This is a mathematical observation, not a
numerical stability or recommended-range claim.

## Changes to make before freezing

1. State coefficient units: attraction is inverse time squared; repulsion is
   coordinate units per time squared; repulsionRadius is coordinate units; dt is
   time; velocities and maxSpeed are coordinate units per time. Returned forces
   are accelerations under unit mass. Damping is a fraction applied once per
   invocation, not a time-normalized drag constant. Subdividing dt does not preserve
   behavior with unchanged damping.
2. Freeze the written primitive order. In the active repulsion branch compute
   `ratio=length/repulsionRadius`, `falloff=1-ratio`,
   `strength=repulsion*falloff`, then `ux=dx/length`, `uy=dy/length` and the two
   products `strength*ux`, `strength*uy`. Subtract those from the separately
   computed attractive components. Do not replace this by `strength/length*dx`.
   State whether force construction is full x then full y, and define accumulator
   updates explicitly as i.x, i.y, j.x, j.y or another fixed order.
3. Explain that the new step damps before displacement. With damping=0 it does
   not move at all. Existing `motion.target-springs-2d` advances position before
   retention, so retention=0 still moves on that tick. Either order is defensible;
   do not imply these are interchangeable integrators.
4. Resolve the native schedule. `query(old) -> step(old,pairs) -> draw current
   contact lines` draws stale relationships if it uses old pairs on next points.
   Draw pre-step query edges before advancing, or query next points for post-step
   current relationships. Freeze the logical-tick convention in the study.
5. Specify that index identity is stable only while the caller preserves the
   same ordered population. `[i,j]` is the pair identity; no packed integer/string
   ID is needed. Sorting for the sweep must not reorder caller state. Population
   insertion, deletion, reordering and lineage remain outside this slice.
6. Distinguish the numerical policies: query overflow in dx/dy/hypot is an
   outside-radius screen; a caller-supplied force edge with nonfinite difference
   or length is NUMERIC_OVERFLOW. This is useful and intentional, but deserves a
   fixture because the same finite coordinate set can succeed in the query and
   fail when forced into a custom graph.
7. Say that returned forces precede damping and speed capping, so they are not
   the realized velocity change divided by dt. Check all arithmetic even when
   attraction, repulsion, damping or maxSpeed is zero. No hidden short circuits
   may erase a defined overflow.
8. A trail rendering of the same proximity simulation is a useful second
   presentation but a weak test of graph substitution. Add a small fixed graph
   response fixture and, if practical, an original glyph/chain relaxation study
   using the same step with supplied edges. This is a design transfer, not a
   withheld external-artwork recreation.

## Query and validation details to preserve

- Finite nonnegative radius, inclusive comparison, no global epsilon. Radius 0
  means exact coordinate duplicates after zero canonicalization. Different
  indices at coincident positions remain distinct; self pairs never occur.
- Describe membership as exact topology under the declared rounded binary64 /
  fdlibm computation, not exact real-number Euclidean geometry. A barely outside
  real distance can round onto the inclusive threshold.
- Sorting must use comparisons rather than subtraction. Canonical output order
  is lexicographic original indices regardless of sweep discovery order.
- `N+C` is an abstract allowance where C counts every x-window pair, including
  those later rejected by y or radial distance. The failed terminating x-window
  comparison is not another candidate event. Sorting time is not represented by
  that counter. State O(N log N+C+K log K), not merely O(N+C).
- Complete passive-carrier/static validation precedes work failure, even for
  empty populations and zero budgets. Reject nonfinite numbers, booleans, sparse
  arrays, reversed/self/out-of-range pair indices, duplicate or unsorted pairs.
  Step pair order is an explicit canonical-input requirement; never silently
  merge duplicates or sort malformed input.
- No partial output on work or numeric failure; inputs and earlier returned
  states remain unchanged. Outputs are detached at every nested pair, including
  empty and no-force cases. Canonicalize exposed zeros only; preserve specified
  intermediate arithmetic.
- No world rectangle, wrapping, clamping or boundary steering. Viewport clipping
  is presentation. A simulation that eventually leaves the canvas is not secretly
  periodic. Query radius is a sensing neighborhood, not shape collision/contact.

## Distinguishing fixtures

| Case | Expected distinction |
|---|---|
| Points (0,0),(3,4), radius5 | Includes [0,1]; just-outside neighbor excludes under fdlibm profile |
| Three identical points, radius0 | Exactly [0,1],[0,2],[1,2], no self or deduplication |
| Points (1,0),(0,0),(0,1), radius1 | Exactly [0,1],[1,2], in original-index lex order |
| Three x=0 points at y=0,10,20, radius1 | Empty output still costs N+C=6; rotated arrangement costs3 |
| Same query budget5 then6 | WORK_LIMIT then complete empty result; no partial successful result |
| Late invalid point with budget0 | INVALID_INPUT precedes WORK_LIMIT |
| Opposite huge x coordinates | Infinite x difference screens out, query succeeds |
| (0,0),(MAX,MAX), radiusMAX | Infinite hypot screens out; explicitly supplied force edge fails NUMERIC_OVERFLOW |
| Nonzero subnormal axis separation | Query does not square it into false coincidence |
| Two points x=0,1; a0,b1,R2,dt1,damping1,cap10 | Forces -.5,+.5; next x=-.5,1.5 |
| Two points x=0,2; a=.25,b1,R4 | Zero pair force: analytically balanced attraction and repulsion |
| Three points x=0,1,3; edges01,12; a1,b0,dt1,damping1,large cap | Forces1,1,-2 and next x=1,2,1; catches in-place/asynchronous state updates |
| Coincident pair, nonzero repulsion | Zero pair force; no RNG, index-direction nudge or normalization divide |
| Pair at exactly repulsionRadius | Repulsion branch inactive; attraction still applies |
| No pairs, nonzero velocity | Damping, cap and displacement still execute |
| Damping0 | Zero velocity and unchanged position, distinguishing target-springs retention order |
| Velocity (3,4), cap2.5, no force,damping1,dt1 | Next velocity(1.5,2), movement follows capped velocity |
| Unsorted/duplicate/reversed graph | INVALID_INPUT, no silent canonicalization |
| Retain old state, call twice independently, edit output pairs | Replay agrees; no input/output/sibling aliasing |
| Graph fixed while points move outside sensing radius | Step retains supplied edge; it never runs a hidden spatial query |

Fixtures should use an independent brute-force radius oracle with the same numeric
predicate but no sweep for small distributions. Include negative coordinates,
equal-x runs, exact thresholds and random small sets. Do not make native image
similarity stand in for these semantics. Compare pair topology and errors exactly;
use explicit numeric tolerance only where a fixture genuinely needs it.

## Authoritative references and remaining source limits

The current catalog metadata is `evidence/external-art/2026-09/corpus.json`.
Its artist catalogue records explicitly leave individual algorithms unassessed.
`reference-analysis.json` contains earlier mechanism notes, not acceptance.

| Reference | Exact current source metadata | Mechanism evidence and limit |
|---|---|---|
| Casey Reas, Process18 | corpus id `casey-reas-recjrha9odoj8kk9v`; source_record_id `recjrha9ODOJ8kk9v`; 2008; Software; stable page https://index.reas.com/work?id=recjrha9ODOJ8kk9v; selected p18.png 616×458 | https://reas.com/process/ section Process4–18 describes touching Element5 endpoints, quadrilateral appearance and fading after separation. It does not specify this force law, finite-radius point predicate, timestep or numerical parameters. |
| Casey Reas, Tissue | corpus id `casey-reas-recrvd9by1oqimfxm`; source_record_id `recrVD9BY1OqiMFXM`; 2002; Software; https://index.reas.com/work?id=recrVD9BY1OqiMFXM; Tissue-SAS.jpg 616×462 | https://reas.com/microimage/ sections Tissue and Braitenberg's Vehicles describe simulated machines responding to environmental points, with sensory/motor wiring. A symmetric point-pair force engine does not provide that wiring. |
| Casey Reas, Tissue B-01 | corpus id `casey-reas-rec43l2klsoun8ezb`; source_record_id `rec43l2kLSOUn8ezB`; 2002; Print; https://index.reas.com/work?id=rec43l2kLSOUn8ezB; 1.jpeg 616×479 | Same series mechanism evidence; print metadata and an image do not specify machine parameters. |
| Anders Hoff, Differential Lattice (contrasting future transfer) | corpus id/work_id `graphic-v2-a0469b38cbef`; artist-described; https://inconvergent.net/generative/differential-lattice/; selected difflat.gif, difflat-3.gif, difflat-plot.jpg | Existing expansion plan explicitly distinguishes relative-neighborhood construction, insertion and normalized-vector relaxation. The proposed step alone does not supply those graph changes or claim that relaxation law. Direct web retrieval failed in this review; do not elevate local summary into a freshly verified implementation claim. |

Reas primary mechanism pages were read both from preserved local HTML and live
on2026-09-17. No native source-code implementation was recovered or inspected;
these are artist-authored descriptions plus catalogue metadata. In particular,
the Process page defines Element1 but its selected Process18 passage does not
fully define Element5. It is unsafe to silently replace its contact geometry
with the proposed point-radius predicate.

Existing accepted neighboring operations inspected:
`catalog/operations/target-springs-2d.json` (`motion.target-springs-2d`0.1.0),
and `catalog/operations/nearest-segment-contact-2d.json`
(`geometry.nearest-segment-contact-2d`0.1.0), with accepted attestations in
`catalog/validation/`. The former explicitly excludes inter-body forces;
the latter returns one nearest directed segment contact, not all touching pairs.
Neither is equivalent to the proposal. Reuse passive data, detached ownership,
explicit errors and ordered binary64 practices, but do not inherit unrelated
native object APIs or exact-rational contact semantics.

Bound read hashes:

- corpus.json: `c25caa8edf07e11bf1f97cc5a1d70dd65a915620992bc0b3d3746c80ae59d209`
- reference-analysis.json: `93c05a2bdda26b1fae491037deb62a100b592e3cca86b142a062c8d14d94a1ca`
- .work/external-art-research/reas-process.html: `49f3177b1a7979c5a4f04ae89266b5747fd900fee730b7e5e30289fb4fd85712`
- .work/external-art-research/reas-microimage.html: `5f8452020f832ee2817cfc2dc3e29a7a4fbf752b8a1115a9cc208769ca88f428`
- target-springs-2d.json: `978d6aa4146ef8cd502fdd93a9a0ba3884e435bdba25ad4f8f22814e608f2eb3`
- nearest-segment-contact-2d.json: `3c5d06d3042d992205f0719cac2061a25653bf26edf5c3d70b0ec56f65489e54`

No source changes, render, fixture execution or acceptance was performed.

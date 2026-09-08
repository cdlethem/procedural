# CP9 exact topology prototype findings

**Status:** bounded private investigation. This is neither a triangulation admission nor
an operation contract, implementation, portability claim, or rendering result.

The experiment tests the strategy selected in
[CP9 triangulation strategy](cp9-triangulation-strategy.md): build a fan from strict
convex-hull corners, insert every remaining unique site in canonical order, then restore
Delaunay topology by exact edge flips. It intentionally does not copy the surveyed
Bowyer–Watson tabs.

## Artifact and execution

- Diagnostic: `tools/diagnostics/cp9/topology_prototype.py`, SHA-256
  `7e10182d23e5434a9af9b5dcd069de29b55bc224c48bb9d8caf18af96ad935ed`.
- Command: `python3 tools/diagnostics/cp9/topology_prototype.py`.
- Result: ignored `.work/cp9-topology/result.json`, SHA-256
  `f087f25c5b30046be8ed445776c18474501a63244fefe3bd42af792bc46ebdb9`.
- Outcome: 21 registered cases passed, including three duplicate-input permutations;
  215 total flips; maximum 1,053 candidate-edge examinations in the 25-site random
  case; elapsed 261.980 ms on this host. These are diagnostic observations, not a
  production benchmark.

The prototype accepts only Python integers and `Fraction` coordinates, canonicalizes
identical values before topology construction, and limits a run to 64 distinct sites or
100,000 edge examinations. It writes a terminal failure witness—case input, stage, and
available topology context—to the same ignored result file rather than falling back to a
floating-point epsilon or silently changing the strategy.

## Independent checks

Topology construction and checking are deliberately separate in the diagnostic:

- Flips use one translated three-by-three-style incircle expression. The all-site
  empty-circle check instead computes a four-by-four lifted-coordinate determinant with
  exact rational Gaussian elimination. It checks every returned face against every other
  unique site.
- Construction uses a monotonic strict hull. The verifier independently gift-wraps the
  corner hull and independently finds supporting lines by testing every site pair. It
  checks area against that independent hull, requires every boundary edge to lie on a
  supporting line, and requires every site on a supporting hull line to occur on a
  boundary edge.
- The verifier rebuilds edge incidence from face triples, checks one or two incident
  faces per edge, positive exact face areas, nonincident-edge crossings, all-site
  participation, and the local cocircular diagonal rule. It does not reuse the
  construction's mutable edge queue or face list.

The all-collinear bypass retains 12 canonical unique sites and their input-record
mappings but deliberately emits zero faces and zero edges. That is a private diagnostic
outcome matching the current boundary decision, not a public result schema.

## Cases exercised

| Case | What it tested | Result |
| --- | --- | --- |
| `triangle` | Minimum two-dimensional input. | One positive face; no flips. |
| `square-cocircular` and `cocircular-octagon` | Initial fan from the smallest canonical site across tied cells. | The fan already uses the locally lexicographically smallest diagonals; no tie flip was needed. |
| `cocircular-tie-flip` | A tied local quadrilateral produced after boundary-edge insertions. | One exact zero-incircle flip changed edge `[1,4]` to smaller `[0,3]`; the final topology passed the independent checks. |
| `hull-collinear-sites` | Four boundary-edge insertions and one internal-edge insertion. | Eight faces, two strict incircle flips, exact hull coverage. |
| `internal-edge-site` | A point exactly on the initial fan diagonal. | The two incident faces split into four, with no zero-area face. |
| `rational-interior` | Non-integer exact coordinates. | Six faces and three strict flips; all checks passed. |
| `duplicates` plus reversed, rotated, and sorted permutations | Canonical duplicate mapping and input-order independence. | Five unique sites; all three permutation signatures equal the base signature. |
| `all-collinear` | Long collinear run. | Explicit zero-face, zero-edge bypass. |
| `random-integer-03` through `random-integer-25` | Twelve deterministic small integer point sets. | All passed; the 25-site set exercised 42 flips and 1,053 edge examinations. |

The implementation records every insertion as face, boundary-edge, or internal-edge and
every flip as strict-incircle or cocircular-lex. The successful cases include all three
insertion categories and both flip reasons.

## What survived this bounded probe

For these small exact inputs, the selected construction retained all unique sites in the
two-dimensional cases, did not emit zero-area faces, had exact face-area equal to the
independently constructed hull area, and reached a local exact-Delaunay state without a
repeated topology state. The deliberate cocircular tie case exercises the selected
lexicographically smaller-diagonal policy rather than merely observing that a hull fan
can already satisfy it.

This supports continuing the strategy investigation. It does **not** prove termination
for arbitrary site sets: the work cap and repeated-state detector remain essential
investigation guards, not a termination proof. Nor does it establish output ordering,
input error behavior, duplicate policy, capacity policy, or binary64 implementation
semantics for a future operation.

## Remaining evidence and engineering gaps

- The script is exact over small integers/rationals, not a production implementation over
  all finite binary64 values. The separate CP9 predicate feasibility work covers exact
  binary64 determinant signs; it has not yet been integrated with this topology probe.
- There is no representative hundreds-of-sites or stress workload here, and `Fraction`
  object cost is intentionally unsuitable for a Java/library performance claim.
- The local lexicographic tie policy is checked only through the bounded cases. Root's
  separate exhaustive cocircular analysis is the stronger evidence for that policy; this
  script does not reproduce it.
- All-collinear, fewer-than-three-unique, non-finite, and extreme-coordinate result/error
  policies remain contract choices. The bypass here prevents accidental zero faces only.
- No rendering, corpus reproduction, third-party-library comparison, target port, or
  public API follows from this result.

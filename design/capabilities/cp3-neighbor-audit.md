# CP3 neighbour audit: occupancy and fixed spacing

This is bounded evidence retrieval for the CP3 size-aware, ordered circle-prefix
filter investigation. It makes no candidate disposition, API, default, range, or
implementation decision. No upstream source was opened: the checked-in notes state the
needed distinctions, and the separate [packing source audit](cp3-packing-source-audit.md)
already establishes the variable-size circle predicate used for comparison.

## Exact records and boundary

| record | checked-in note SHA-256 | candidate text | computation actually evidenced | boundary with the audited circle prefix filter |
|---|---|---|---|---|
| `2015/Generativos/uiFuturistGrid#0` | `2d13b46e71e17fe668ddf98c890fc6fc16e5fb08d7b4213b17620fd06580cb0c` | `packRects(gridW, gridH, cellSize, rand) -> Rect[]` — “random non-overlapping square blocks packed into an occupancy grid” | `newForms()` chooses square widths/heights in a discrete occupancy grid and records cells with no shared occupied grid cells. The resulting forms supply widget positions and sizes; their drawing is commented out. | This is discrete cell occupancy for square blocks. It neither proposes variable-radius circles nor compares Euclidean centre distance against a size-dependent threshold. It is useful evidence for a distinct grid/rectangle mechanism, not a substitute for the ordered variable-circle predicate. |
| `2018/Generativos/persons06#0` | `f2beb3cdc33f72f9e9e97a41b81f961d031bdd5f950f1a662d6068d36946f8d0` | `gridPersons(count, cellSize, personScale) -> Person[]` — “scatter persons snapped to a fine grid with min-distance rejection” | `generate()` derives a `gridSize`, snaps each attempted person position to that grid, then rejects when the centre is within fixed 5 px of an earlier person. Person size is derived from grid size, with occasional variation, but is not part of this reported rejection test. Positions later drift during animation. | This motivates an artist-facing crowd-spacing task, but it is grid-snapped, fixed-threshold point spacing with animated agents. It does not establish size-aware circle exclusion, tangency, or the proposal-domain semantics of the circle filter. |

The candidate-triage evidence hashes are respectively
`c98166b5adfb7a368d4a93b5b8691b41f3fb1d213aaddfcfc1ecdb91d8cd866e` and
`f1eb416c1ab96ceee92676fd127dd946ee365f80ef48ea608c412ec90f741dc3`.
Both remain `review_required` / unreviewed in the authored decision state; this memo
does not alter that status.

The circle comparison is intentionally narrow. The pinned-source audit records accepted
prefix order and a size-dependent distance predicate for `caramelo` and `studio`; it also
records their non-interchangeable proposal domains, equality handling, and stream use.
Neither neighbour supplies evidence to collapse those choices into occupancy or a fixed
minimum point separation.

## Recorded size/domain substitutions

The following values come from the checked-in JSON result records, not from images.
All three runs report `status: ok`, seed 42, one retained first-frame record, and dropped
frames 10/60 as identical to frame 1. They establish a measured whole-composition change
for each exact substitution, not a standalone parameter rule.

| record | result SHA-256 | exact substitution | renderer / reported metric | evidence limit and confounds |
|---|---|---|---|---|
| `2018/Generativos/caramelo`, `maxsize_0.25` | `e56de0b64dd4fcb9d2303962da5b019470cba76f7a19433780702e165978b64e` | `width*random(0.5)*random(0.5, 1)` → `width*random(0.25)*random(0.5, 1)` | P3D; `mean: 0.2798`, `changed_fraction: 0.884`, `label: large`; first-frame time 1968 ms versus 1822 ms baseline. | The note explicitly says the packing layout reshuffles because acceptance changes random-stream consumption. It provides no accepted-count, diameter histogram, comparison count, or isolated geometry measurement. The report calls the value a radius, while the source audit establishes diameter-valued storage; this record must not support a public unit or continuous range. |
| `2017/Generativos/studio`, `maxSize_120` | `a35a8e487c7e87c6f0110d5b4104586ed6dcbf676f95c3fb85b1e77d59aa9737` | `random(320)` → `random(120)` | JAVA2D; `mean: 0.0595`, `changed_fraction: 0.225`, `label: moderate`; first-frame time 249 ms versus 253 ms baseline. | It changes the proposed size distribution before sequential rejection. The record does not report accepted count, actual diameters, candidate comparisons, or a size-only outcome separated from new later placements and dashed-ring rendering. It is not evidence for an interpolation rule or recommended bounds. |
| `2017/Generativos/studio`, `radius_2.0` | `d4f54ae5d15c1a8c2075303f0ab9356d596ba21ce49b0dff443893a9755323f6` | `random(cx*1.5-s)` → `random(cx*2.0-s)` | JAVA2D; `mean: 0.0602`, `changed_fraction: 0.219`, `label: moderate`; first-frame time 226 ms versus 253 ms baseline. | This is a proposal-domain change, not a size-limit measurement. It changes where centres can be proposed and thereby the accepted prefix and rendered ring layout. It reports no containment decision, output-count accounting, or source-range evidence for a general radial-domain control. |

The associated note hashes are caramelo
`204b387d9aec0e058834a48bc56417caf9ae0c582b93937676e3a2ca17d10708` and
studio `9bde5b7853dcf6b6cc0f7b9c80f24ccedf8910690f7fc17d333a7e1ece6f67d5`.

## Evidence gap carried forward

The neighbour records are enough to keep three computations separate: grid occupancy for
rectangles, fixed-distance snapped agent placement, and sequential size-aware circle
rejection. They do not resolve a reusable proposal distribution, containment policy,
equality rule, portable RNG stream, attempt/output accounting, or parameter range. The
variant results only show the listed substitutions’ image differences and runtime metadata;
they do not fill those semantic or measurement gaps.

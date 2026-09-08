# CP5 ledger capability-dependency admission review

Status: proposed for root integration. This review does not change the authored ledger,
freeze a contract, admit implementation, or alter any original candidate disposition. The
reviewable JSON patch is [`.work/cp5-ledger/admission-proposal.json`](../../.work/cp5-ledger/admission-proposal.json).
It is bound to the current ledger SHA-256
`1c5309c06e30c51f500ce9156ab76d99357d221e732c61219af196fed849398c`; root must
refresh or reject the proposal if the ledger changes first.

## Evidence binding

The proposal binds the root-selected boundary
[`cp5-sampling-boundary.md`](cp5-sampling-boundary.md) at
`c49b08846201373fcfd3e1b6781f093e9c577262dd41ffea983e708bf80efa27`, the exact
[source audit](grain-evidence-audit.md) at
`5a7f58babca28374ca51b915438bd54566a39b85ef2d128bddd6a81d21c27c81`, and the
accepted private review at
`evidence/parameter-experiments/cp5-grain/root-review.json`
(`9fe4de08949a8dea57f9760ea27742c644523c03ff0057cd05c1f04b7cf78895`). The
private result is bound at
`evidence/parameter-experiments/cp5-grain/result.json`
(`4c271053fbec4de47ae3b8fa2e427c0c0a3017a7c54fa974e8b276423a5cf30a`).

The accepted seven-image investigation supports retained geometry across recolour and
mark substitutions, a longer uniform prefix, and transfer from CP4 rectangle bounds. It
also shows the two active source coordinate patterns are visually and numerically distinct
from uniform sampling. Its Java `Random` stream, fixed density/count settings, alpha and
palette remain private evidence, not public settings or source replay claims.

## Candidate identity and source scope

`2018/Generativos/puntis2#1` is the only named `randInTri` helper candidate. Its ledger
source/note hash is `a4b45e254cc656cb3aee8eb6bd6b7f1dfca0a23c56a182d71380ba8a73c09dfe`
and its candidate evidence hash is
`61df2a3b1d8c3ee3f3abc0ffaa2cceaf273b5cb7227786434ab92cdd9acd21a1`.
The pinned `puntis2.pde` hash is
`e58a65c8f7794bb85f4fdd3747d9a17f95711354d4314e3862bdb6f72f804335`.
The audit establishes that this standard two-uniform helper is **unused** by the active
puntis/puntis2 grain loop. It supports the mapping mechanism, not a false claim about the
executed grain distribution.

The active loop in `2018/Generativos/puntis#0` is source-bound by note hash
`98ad640b63e2ec0872af61406743bd2b5852dd7744301ec74a337ebe0d75430b`, candidate
evidence hash `d06ada2d7b1ba40958706d8aa596a00afe61242c8d36af7f1f52dd785b9014f9`, and the
same pinned PDE hash. It maps `(U×V, W)`, so the first supplied vertex has a different
weight than in uniform sampling. Its stale note wording calls the active loop uniform;
the source audit corrects that evidence conflict.

The active loop in `2018/Generativos/puntis3#1` is source-bound by note hash
`9699082e346a3e7f22798f6a932e4c42df28c9435e922365ad2c3c7de59c7e9c`, candidate
evidence hash `ae90e11c37f949b9d5ff1f820c14fbd2a9d0650227a0b2c5bc43433c8cd06931`, and
PDE hash `abe82f16a6b1a4f28aa442fad0340ba8c325f994127babebcdc0df6fd43868c3`.
It consumes three brightness draws and a `dd` draw before constructing a biased second
coordinate, then consumes a fresh first coordinate. The public coordinate mapper would
not replay those consumed draws; it accepts the two coordinates explicitly.

## Proposed dependencies

`sampling.seeded-triangle-points-2d` is a convenience batch: supplied triangle, seed and
count produce retained uniform point positions. It carries its own future portable stream
and removes repeated caller-side RNG/batching work. It does not retain the historical
one-point helper as a public alias.

`sampling.triangle-coordinate-map-2d` accepts a supplied triangle and supplied unit-pair
batch. It has no RNG or uniformity claim. Independent uniform pairs are a caller-side
precondition for uniform area sampling; `(U×V,W)` and puntis3-style pair generation are
motivating substitutions, not source-named strategies added to the API.

Both admissions explicitly leave Delaunay/site construction, triangle ordering, Heron
area calculation, `ceil(area×density)` allocation, palettes, alpha, point/stroke emission,
whole-mark clipping, and target raster semantics outside the dependencies. Contract review
must separately settle triangle/unit-pair validity, seed protocol, exact arithmetic and
endpoint semantics, count/resource behavior, immutable carrier/accessor rules, error
precedence, and seeded-to-explicit distinguishing fixtures.

## Existing ledger records remain unchanged

The proposal asserts, but does not edit, these present dispositions:

- `puntis#0`: `keep` in `mark.stipple-triangle`.
- `puntis2#0`: `review_required` / `reviewed_defer` in `mark.stipple`.
- `puntis2#1`: `keep` in `sampling.point-in-triangle`.
- `puntis3#0`: `review_required` / `reviewed_defer` in `geometry.delaunay`.
- `puntis3#1`: `merge` in `mark.stipple-triangle`.

The two additions are `capability_dependency` clusters without ordinary record members,
following CP4's admission shape. They do not merge, reclassify or imply contract readiness
for those original records.

## Root integration

Root inspected the complete two-cluster proposal and applied both admissions. All original
candidate records and dispositions remain byte-equivalent as parsed values. Root also
corrected the historical stipple cluster rationale to record the active nonuniform source
loops, and marked standalone one-point implementation as superseded by the two batch
responsibilities. This is architecture admission only; exact contracts remain pending.

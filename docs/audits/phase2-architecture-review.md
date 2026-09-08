# Phase 2 decision and architecture audit

Date: 2026-09-07. Evidence revision:
`b64fadf8cc484025f58a112b95630a7b0c420ea3` (826/901 reports).

**Finding: the evidence infrastructure is useful, but the previous adjudication process
was not sufficient to freeze an API.** It mixed computational families with operations,
merged algorithms with different state/topology under unspecified “policies,” and sometimes
rejected a sketch's visual theme instead of the candidate actually named by its record ID.
These defects have been course-corrected in the authored ledger, architecture and review checks.
The result remains a provisional design, not a validated drawing package.

## Scope and method

Root integrated Terra's architecture review and Luna's rejection/evidence reviews. The audit
compared the candidate's exact ordinal, signature and explanation with its parent code
walkthrough and modularisation prose. Agent proposals were independently reconciled before
acceptance: several proposals confused neighbouring ordinals or described a whole scene
instead of the nominated helper. This report supersedes those draft findings.

All 35 rejections at audit entry were reconsidered. Merge review focused on subdivision,
flow, walks, geometry/mark boundaries and the first composition; it was a risk-based audit,
not a fresh exhaustive semantic review of every accepted member. All 1,934 records received
structural/source-consistency validation. These are different levels of assurance.
No new render was inspected or produced. Visual claims rely on the checked-in notes and
published measurements, not imagined appearance or new conformance evidence.

| disposition | before audit | after audit |
|---|---:|---:|
| keep | 27 | 26 |
| merge | 163 | 151 |
| reject | 35 | 18 |
| review_required | 1,709 | 1,739 |

Thirty decisions were reopened: one keep, twelve merges and seventeen rejections. The
383 previously assessed records remain 383; reopening is not new coverage. Of those,
195 now have provisional keep/merge/reject dispositions and 188 remain unresolved.
Another 1,551 records are unreviewed. Earlier values and reasons are retained in each
reopened record's `audit_history` in the [ledger](../../design/phase2/cluster-decisions.json).

## Substantive corrections

**Path state was being lost.** [pelines#0](../../survey/out/2018/Generativos/pelines/notes.md)
constructs independent grid strokes, with no feedback integration. It was incorrectly
merged with flow tracing. [pelolos002#0](../../survey/out/2018/Generativos/pelolos002/notes.md)
does integrate in 2D, despite a misleading candidate shorthand, but its progress-dependent
angle envelope and drifting row scale need explicit separation from strip rendering.
[pelines3d002#0](../../survey/out/2018/Generativos/pelines3d002/notes.md) has persistent
3D agents, a rolling ten-point history and lifetime/replacement state. All three merges
were reopened; similar-looking paths do not establish matching transition semantics.

**Subdivision topology was obscured by the word policy.**
[chinasseForms#0](../../survey/out/2017/Generativos/chinasseForms/notes.md), the former
kept representative, creates `sw*sh` grid children. It cannot establish equivalence with
four quadrants. [lavita03#0](../../survey/out/2019/generativos/lavita03/notes.md) jitters
a parent and creates two children, changing coverage before splitting. The former keep
and seven merges (`NeoGeo#0`, `mosaic#0`, `mosaic02#0`, `caritas#0`, `casca#0`, `dadano#0`,
`lavita03#0`, with full paths in the ledger) are now unresolved. Four-way rectangular
splitting remains supported as an investigation; variable grid refinement, integer
rounding, leaf scheduling and domain geometry need separate decisions.

**Walk transitions were treated as interchangeable.**
[tata#0](../../survey/out/2019/generativos/tata/notes.md) uses bounded four-neighbour
movement, occupancy and up to four proposals per step. [guagua#1](../../survey/out/2019/generativos/guagua/notes.md)
is orthogonal rather than six-neighbour hex movement. Both merges were reopened.
Neighbour sets, attempts, early termination and occupancy ownership change outputs and
random consumption; an ordered coordinate list alone is insufficient evidence of equivalence.

**Whole-helper rejection lost components.** Seventeen rejected records were reopened,
including tick/ruler geometry, HUD subcomponents, recurring articulated figures, line fans,
cell placement, radial marks and warped disk geometry. In particular,
[caritas#1](../../survey/out/2019/generativos/caritas/notes.md) is a checkerboard,
[paraisooscuro#1](../../survey/out/2019/generativos/paraisooscuro/notes.md) is a warped
triangle-fan disk, and [clim#1](../../survey/out/2020/generative/01_04/clim/notes.md)
is a dot burst. Rejecting their parent scene's style did not adjudicate those computations.
Conversely [poses#1](../../survey/out/2020/generative/05_08/poses/notes.md) is a pastel
disc, not the adjacent stick-figure candidate; its wrapper exclusion remains. The
[complete rejection review](phase2-rejection-review.md) accounts for all 35 original records.

**Remaining exclusions now preserve component obligations.** All 18 are exclusions of
additional public wrappers, with explicit recipe, adapter or deferred-component destinations.
For example, the random blend in `triangulitos#1` is not already covered merely because
cyclic palette interpolation is being investigated. `chinasseForms#1` includes non-font
marks as well as glyphs. Deferred components remain work to do; listing a destination does
not claim an implementation exists. There is no blanket rejection of a major idiom.

## Architecture corrections

The [revised design](../api-design.md) distinguishes investigation families, narrowly scoped
portable operations, mark construction, rendering adapters and convenient recipes/templates.
The budget of 30–80 applies to public computational operations, not cluster labels or every
small extracted helper. This avoids both giant mode-switch APIs and a bag of tiny arithmetic
functions that leaves users to reconstruct the art themselves.

All retained investigations now have an explicit pending architecture record. Grid transforms
remain a family; triangle stippling is a recipe candidate; uniform triangle sampling is a
narrower operation candidate. None is silently contract-ready. Annular geometry must be
separated from vertex attributes and rasterization. Typography placement is explicitly a
portable investigation even while font and glyph rendering remain capability work.

Composition now includes typed value joins and explicit stochastic ordering. A palette picker
does not consume a sampled point. In the initial `puntis` composition one colour is chosen
per triangle before its samples, while related sketches use different per-dot styling.
The sampler can be common without conflating their drawing recipes. The small triangle
slice remains a useful dependency-first experiment, but architecture acceptance also requires
concrete grid/noise, flow, scattered-form, branching, 3D and typography compositions.

## Coverage and limits

Current tag counts below are derived from the SQLite sketch-technique join and ledger
statuses. Categories overlap; “assessed” includes deferrals and rejections, not only keeps.

| technique tag | sketches | candidate records | assessed records |
|---|---:|---:|---:|
| grid | 430 | 1,091 | 207 |
| noise-field | 345 | 868 | 162 |
| flow-field | 38 | 91 | 91 |
| voronoi-delaunay | 54 | 176 | 86 |
| recursion | 27 | 63 | 17 |
| typography | 15 | 44 | 41 |
| physics | 1 | 3 | 3 |
| l-system | 1 | 1 | 1 |
| 3d-mesh | 95 | 227 | 52 |
| pixel-ops | 28 | 80 | 11 |

The earlier review disproportionately covered typography/Delaunay; most dominant grid/noise
candidates remain unreviewed. All flow-tagged candidates being assessed did not prevent bad
merges. Next batches must address the reopened algorithms and dominant composition cases,
while retaining explicit rare-family decisions. Physics and L-system evidence remains thin;
the latter supports line-pool subdivision, not a general grammar engine. Missing reports
cannot establish absence. Four-target renderer support remains unverified.

## Process safeguards implemented

- Ordinary validation checks exact evidence bindings, all record identities, statuses,
  parent-note provenance, kept merge representatives, decision counts and audit structure.
  Rejections now require an explicit computation/component audit.
- `--contract-cluster ID` additionally requires a reviewed operation-candidate architecture,
  concrete input/output/invariants, no architecture questions, an audited keep/merge membership,
  and no unresolved record still assigned to that cluster. A family cannot pass as an operation.
- Component extraction requires explicit disposition and rationale for its remainder. Future
  semantic reviewers must inspect related unresolved records as well; reassigning an ID cannot
  legitimately substitute for that review.
- Agent briefs now require exact candidate snapshots and component accounting, with independent
  integration-owner verification. A schema validator cannot establish computational equivalence.
- The operation-contract workflow and checkpoint now distinguish structural eligibility,
  semantic review, a frozen contract and actual execution/reproduction evidence.

These safeguards improve auditability; they do not mechanically prove a useful API. The next
semantic review and cross-idiom compositions are required before claiming architectural completion.

## Validation performed

All 49 unit tests passed, including the new contract eligibility, unresolved-member,
component-accounting and provenance checks. Current inventory and ordinary ledger validation
passed; the operation-contract skill metadata validator passed. The triangle contract gate
correctly failed its pending architecture and open questions. No native operation or renderer
conformance was claimed.

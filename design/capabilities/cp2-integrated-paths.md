# CP2: grow a line, then choose its marks

Status: historical root proposal for I2, resolved by Sol challenge and
[the architecture decision](cp2-architecture-decision.md). The decision supersedes the
two-generation-route and public constant-field suggestions below. This is not an approved
public signature or a claim of ciserp reproduction.

## Artist task and responsibility

Start with a seeded working piece of wandering lines. Change how far each line travels;
then draw perpendicular strokes along the same movement without changing its geometry.
The package must own repeated field evaluation and position advancement. The artist owns
starting locations, field mapping, mark extent, colour and composition. A path result must
be usable without reconstructing the integration loop in sketch code.

The decisive distinction from CP1 is feedback: a heading is sampled at the current position,
and the next position becomes the next query. Assigning headings to fixed grid locations
cannot supply this capability. Root personally read
[ciserp](../../survey/out/2019/generativos/ciserp/notes.md) and
[limo002](../../survey/out/2019/generativos/limo002/notes.md). Ciserp describes 2,000–16,000
steps per start, perpendicular marks and a pale connecting trail. Limo002 describes a spine
followed by short field-driven branches. These support reusable movement with separate
mark treatment; they do not establish identical fields or identical scene semantics.

## Proposed boundary and deliberate alternatives

Investigate one bounded, fixed-distance forward tracer consuming an explicit start, named
scalar field, coordinate mapping, angle base/scale in radians, step distance and step count.
Produce ordered movement records with start/end position, sampled heading and step index.
The initial point is separately available. Progress is derived from index and requested
count under an explicit zero/one-step rule; do not hide this choice in an envelope helper.
The contract must settle whether marks attach before or after advancement. Exposing both
segment endpoints avoids forcing a renderer convention into movement data.

This is an independently specified extraction, not a keep/merge of either entire composite
candidate. Ciserp's signed toxi simplex and limo002's nested custom noise remain distinct.
An initial technique-level example may use the already implemented named gradient field,
but must label that substitution and pass visual checks. Do not add another noise algorithm
solely to reproduce a name; equally, do not claim that unsigned gradient noise is signed
simplex. Root must decide whether its actual output supports the intended line capability.

Keep sine envelopes, endpoint dots, endpoint branch fans and palette-to-black mixing in
editable example code. A joined polyline renderer is a separate capability: independent
segment emission can demonstrate a trace, but must not claim equivalent joins or opacity
at shared endpoints. Collision avoidance, adaptive integration, particle forces, time
stepping and branch topology are outside this first tracer. They remain open capabilities,
not rejected families or implicitly supported modes.

A hard-coded tuft helper hides useful reuse. A one-step helper alone leaves the integration
burden with the caller. Prefer a complete bounded trace API with an explicit retained result
for modest paths and a bounded batch route sharing precisely the same movement semantics.
Determine whether both routes are necessary now through the complete example; do not build
a generic recipe executor or callback serialization framework as a prerequisite.

## Walkthrough to review before freezing a contract

The following is conceptual use, not runnable syntax or a promised signature:

1. Create an explicitly seeded named field and a small set of starting positions.
2. Trace each start for an explicit finite number of steps, retaining movement records.
3. Render each record's start/end as a thin segment.
4. Reuse the same records to place perpendicular segments at a declared endpoint, with
   mark extent derived from progress. Recolour those marks without evaluating the field.
5. Change step count while keeping field, start and step distance fixed. The existing prefix
   must remain identical. Contrast changing step distance, which changes subsequent queries.
6. Replace the field with a constant heading field as a transfer/semantic test: the path
   becomes a straight sequence without modifying the tracer or marks.

The constant-field substitution is a design test, not a surveyed composition. A convenient
field description must remain portable data. An arbitrary host closure may be a native
extension later; it cannot silently become a four-target serializable promise. Assess the
cost of a minimal explicit field description against the current catalog before choosing
it. Keep artist setup concise; examples should expose useful controls in one obvious place.

## Parameter evidence and acceptance dependencies

Ciserp's stored amp substitution changes `random(250, 320)*random(0.2, 1)` to
`random(40, 80)*random(0.2, 1)`, with mean difference 0.1013 and changed fraction 0.35.
This is a distribution edit, not evidence for a constant angular range of 40–320 radians.
Its maxDis experiment affects marks; det affects the queried field. Whole-image differences
do not isolate the resulting movement. Limo002 is marked nondeterministic and provides
weaker causal evidence. No public artistic default or encouraged range is approved here.
Finite counts, finite coordinates and step validity require mathematical semantics; any
practical work/memory cap needs measured resource evidence rather than an arbitrary limit.

Before contract admission:

- Resolve exact motivating candidate identities and remaining components in the ledger;
  independently inspect neighbours and source order if claiming source-faithful semantics.
- Resolve field representation, sample/advance order, numeric tolerances, termination,
  input failure/partial output, output ownership and retained/batch equivalence with Sol.
- Apply parameter evidence to unsupported exposure/default/range decisions; prepare a
  bounded experiment for the chosen example before calling its settings useful.
- Predeclare constant-field, position-dependent-field, zero/one-step, prefix, non-finite,
  long-run and batch-boundary fixtures. A position-dependent fixture must fail if queries
  use the initial position repeatedly. Measure allocation/work at representative counts.
- Implement and demonstrate trace-to-perpendicular-mark reuse, recolour independence and
  step-count versus step-distance edits on all claimed targets. Choose reproduction scope
  before rendering; preserve any source-field divergence in the accepted evidence.

Root owns this decision and complete example. Sol challenges capability and semantic costs;
workers retrieve evidence and subsequently implement only a frozen contract. I1 remains
accepted while I2 investigates these choices.

## Evidence revision

Checked-in snapshot: `b64fadf8cc484025f58a112b95630a7b0c420ea3` (826 reports).
Root-read note SHA-256 bindings:

- `2019/generativos/ciserp`: `c81dd166ecef06592fcb66fcb38cc11a7518813ffbcb700009fa21c555673f34`
- `2019/generativos/limo002`: `7ad145412345a914877e984f6fdf54cb73b0083d2a3eba5db3cb01924881f294`

Root also read all six ciserp variant result records. All report successful unique
substitutions with no recorded warnings. The nested random expressions in `det` and
`maxDis` must be preserved when reasoning about their distributions; frontmatter summaries
alone are insufficient. Images were not inspected in this CP2 investigation. Visual
statements above are explicitly attributed to notes, not new observations.

## Root's neighbour review

Root independently read `2018/Generativos/mantel#0` and
`2019/generativos/natalata#0` after bounded retrieval. Mantel's modularisation explicitly
calls the field walk a reusable polyline computation, but the scene closes and fills the
shape. Automatic closure belongs to its mark treatment, not every integrated trajectory.
Its current provisional ledger merge is not permission to freeze that unexamined behavior.

Natalata's candidate suggests position/progress samples; its parent modularisation includes
envelope and size modulation, and its drawing description interleaves before/after movement
with different marks. An entire-candidate merge into a bare tracer would lose these parts.
The old proposed `path.random-walk` label must not decide its semantics: a deterministic
spatial field queried at evolving positions is not itself independent random stepping.
A retained path is an explicit library design choice, not something either prose proves
was returned by source code. Both notes have empty parameter/experiment sections despite
checked-in variant JSONs; numerical substitutions do not supply missing visual observations.

These findings strengthen the finite path/mark separation, while requiring explicit
remainder accounting and mark attachment timing. They do not promote provisional ledger
members or reject envelopes, flower marks, filled ribbons, or other future capabilities.

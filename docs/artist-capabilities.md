# Architecture from an artist's idea

This is durable capability-admission guidance, not a milestone queue. Current implementation
and target support are in [PROJECT_STATE](../PROJECT_STATE.md). The
[ledger](../design/phase2/cluster-decisions.json) records evidence dispositions;
[api-design.md](api-design.md) explains composition boundaries. Root owns public decisions.

## Start with the decision the artist is making

The opening path should let someone recognize an intention and reach an editable sketch.
They should not need to know the name of an algorithm, read a candidate ledger or construct
a serialized execution graph. The following are proposed entry points grounded in the
reports. Their ordering is a product decision, not a measured preference of artists.

| artist's starting idea | next choice to explain | capability to provide | motivating evidence |
|---|---|---|---|
| Cover a surface with related marks | Place independent marks, or connect movement over time/steps? | Arrange positions, sample spatial attributes, place marks | [pelines](../survey/out/2018/Generativos/pelines/notes.md) |
| Make lines wander or grow into tufts | What moves along the field, and what is drawn at each step? | Integrate a path, then use its position, heading and progress for marks | [ciserp](../survey/out/2019/generativos/ciserp/notes.md) |
| Scatter forms with room between them | Independent scatter, minimum spacing, or varied-size packing? | Placement with an explicit spatial constraint; reuse placements for different marks | [persons06](../survey/out/2018/Generativos/persons06/notes.md) |
| Divide a surface into changing regions | Split geometry versus which region is selected next? | Produce usable cells; give each cell independent content | [mosaic02](../survey/out/2018/Generativos/mosaic02/notes.md), [chinasseForms](../survey/out/2017/Generativos/chinasseForms/notes.md) |
| Give a shape grain or a point texture | Where may points land, and how is their number related to area? | Region sampling and visible mark allocation, separate from shape construction | [puntis](../survey/out/2018/Generativos/puntis/notes.md) |
| Grow branches | Children of each segment, or cuts into a shared set of lines? | Hierarchical geometry with explicit stopping and attachment semantics | [Arboles](../survey/out/2014/Generativos/Arboles/notes.md), [brotes](../survey/out/2019/generativos/brotes/notes.md) |
| Work with letters as repeated forms | Placement and echoes versus font/glyph appearance? | Reuse layout and echo placement with supplied glyphs and explicit font support | [textureGridText](../survey/out/2016/Generativos/textureGridText/notes.md) |
| Build a form in three dimensions | Supply a profile versus scatter points or extrude cells? | Construct and style mesh topology from a profile | [cilindros](../survey/out/2017/Generativos/cilindros/notes.md) |

These are discovery paths, not eight promised functions or an initial release checklist.
Colour, layering, seed variation and saving a result run across the paths. Each tutorial
should explain where colour comes from (per shape, position or step), what controls it,
and whether changing it also changes geometry. “Change seed” is not a substitute for a
meaningful control over structure.

## Two ways to enter the package

**Start from a working piece.** Each selected capability ships with an ordinary native
sketch/template: recognizable output, a few explained controls, an explicit seed, and a
clear place to change the mark or composition. Show controls that affect arrangement,
shape and appearance separately. Example constants are supplied example configuration;
they are not automatically library defaults or measured useful ranges.

**Compose from operations.** The same template opens into a few useful value-producing
operations and mark construction. An experienced artist can replace placement, reuse a
field, retain a path, or draw their own mark without copying the hidden algorithm. Native
code can use ordinary iteration and host drawing as an explicitly host-specific extension;
only the shared portable route carries a four-target guarantee. The JSON-compatible
contract is the specification, not a requirement that artists author JSON.

Deterministic state remains explicit in the specification. A native convenience layer may
own it in an explicitly created seeded session; artists should not have to manipulate RNG
words on every call. No implicit global state. The exact session API, consumption and any
independent streams must be designed and tested. Separating layout and style randomness
would be a deliberate design divergence from shared-stream corpus examples, with a separate
reproduction configuration where necessary. Do not silently promise that every edit preserves
geometry when the chosen random-consumption model does not.

A cohesive higher-level helper can be public when it saves artists from repetitive algorithmic
wiring and preserves useful substitution points. First demonstrate that value in a template.
Public convenience helpers must compose the same underlying operations, share their contracts,
and count as public surface. They must not become another independently implemented algorithm.
A copied scene with many unrelated toggles fails this test; being compound alone does not.

## How a function earns its place

Before a public function is approved, root writes a capability decision answering:

1. **Artist task:** What can the artist make or control with it? State a concrete before/after
   editing task. Candidate frequency and a generic-sounding name are not the answer.
2. **Algorithmic burden removed:** What nontrivial behavior would otherwise need re-deriving?
   Identify what stays as ordinary drawing or artistic choice.
3. **Evidence:** Read exact candidates and parent reports, including contradictory prose,
   observed substitutions and confounds. Distinguish extracted computation from whole helper.
4. **Boundary and alternative:** Why this operation, rather than existing composition, a
   private utility, template, or cohesive convenience function? Name its inputs, reusable
   output and state; compare a near neighbour that it must not absorb.
5. **Control and transfer:** Which meaningful edits must be easy? Demonstrate a second use
   or substitution, clearly labelled a design test when not a surveyed composition. A rare
   but valuable computation need not occur twice to be investigated.
6. **Cost of using it:** Identify prerequisite concepts, setup, glue code, runtime work and
   target constraints. A mathematically clean interface that requires reimplementing the
   technique in caller code has failed. A huge opaque helper has also failed.
7. **Acceptance:** Define distinguishing semantic fixtures, a runnable example, edit/transfer
   checks, measured-parameter limits and appropriate reproduction evidence. Record what has
   actually run, what root only walked through, and what a human artist has tested.

These are design questions, not a scoring formula or another bulk classification job. No
numeric function quota is a success criterion. Retain provenance for the whole corpus, but
review only the neighbours and evidence needed to make the selected capability sound before
expanding. Unknown records remain unknown; they are not rejected or silently declared covered.

## Established boundary example: fields and paths

[FieldMarks](getting-started.md) and [PathMarks](path-marks.md) demonstrate different
computations: independent field samples at supplied positions versus integration in which
positions feed back into subsequent steps. Similar appearance does not justify merging them.
The original [CP1 decision](../design/capabilities/cp1-field-marks.md) preserves the detailed
walkthrough; it is historical design rationale, not pending work.

The [pelines report](../survey/out/2018/Generativos/pelines/notes.md) couples placement pitch
and maximum mark length. Separating them is a package design choice, not evidence of isolated
measured effects. The [ciserp report](../survey/out/2019/generativos/ciserp/notes.md) motivates
integrated paths with independent mark treatment. Its whole-image differences do not by
themselves establish useful ranges for either integration or perpendicular strokes.

Apply this distinction to new capabilities: retain useful values, expose meaningful edits,
and demonstrate replacing their drawing treatment without rebuilding the hidden algorithm.
Do not reopen completed CP1/CP2 work or infer new family support from those examples.

## Delivery and ownership

Root reads the decisive evidence, chooses the public boundary and alternatives, writes the
capability decision, and reviews its first complete example. An independently scheduled review may
challenge those choices; it does not replace the architect. Luna/Terra
handle exact retrieval, checks and frozen-contract implementation under bounded ownership.
See [agent briefs](agent-briefs.md).

Capability acceptance replaces exhaustive candidate adjudication as the delivery gate.
Start with a small honest scope and expand when a new capability earns its complexity.
Four-target claims still require all four targets; each promised capability needs declared
semantic and reproduction tests. The full-corpus benchmark remains a research/regression
aspiration and a distinct certification mode, not a prerequisite for shipping a useful
scoped package. Never label a selected suite a full-corpus pass, remove failures after a run,
or invent a benchmark policy change without an explicit reviewed scope and manifest.

## Marginal recreation coverage

Apply [recreation coverage](recreation-coverage.md) to admission decisions. List original
sketches newly enabled, defining computations still missing, and distinct transfer patterns;
compare this gain to concepts and maintenance added. Keep projected support distinct from
executed recreations. This augments the artist-task decision above and does not turn coverage
counts into permission for per-sketch branches or a tortured public API.

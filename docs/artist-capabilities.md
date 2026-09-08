# Architecture from an artist's idea

Current buildout sprint: expand reusable operations and complete workflows on Processing
Java first, then batch the other ports. CP1/CP2 already proved the four-target route.
Sol reviews are paused at the maintainer's request; root owns direct design, code and
artist-example review. Earlier independent-review and per-capability port scheduling
below describes the prior workflow and does not gate this sprint.


Status: architect's direction, 2026-09-07. This supersedes candidate-count-driven scheduling
and the triangle sampler as the first artist milestone. It does not freeze public signatures,
parameter recommendations or renderer support. Source membership remains in the
[ledger](../design/phase2/cluster-decisions.json); implementation architecture remains in
[api-design.md](api-design.md). Root owns the choices below and the eventual public surface.

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

## First architect-owned capability: independent field-oriented marks

The concrete [CP1 design and usage walkthrough](../design/capabilities/cp1-field-marks.md)
records root’s public/private boundary decisions and Sol review.

**Decision CP1:** Make a complete grid/noise mark sketch the first artist-facing milestone.
The triangle sampler remains an optional engineering experiment, not the critical path to
proving artistic usefulness. This selects a capability; it does not approve the previously
reopened `pelines#0` merge or a new function signature.

The [pelines report](../survey/out/2018/Generativos/pelines/notes.md) describes a fixed grid
whose short segments independently sample direction, length and colour. Its `gri` literal
couples placement pitch and maximum length. The useful package should let an artist reason
about spacing and length separately. That separation is a design choice informed by the
coupling, not a claim of isolated measured effects: the `gri` experiment changes both.
The reported alpha arithmetic is also inconsistent with the quoted expression's possible
range; use exact substitution metadata and follow-up verification before publishing bounds.

**Proposed responsibility split:** positions from a layout; scalar/heading samples at those
positions; segment geometry from position/heading/length; explicit colour and alpha; ordered
rendering. Canvas endpoint clamping is an example choice, not a universal clipping default.
Do not expose every multiplication as a public function. The exact reusable grouping of
field sampling and attribute mapping is the next root decision, made with a complete sketch
in view. Do not launch a generic graph executor to demonstrate this composition.

**Artist checks before calling CP1 useful:**

- From the entry page, reach a seeded runnable piece without reading the module reference.
- Change stroke length without also changing the placement pitch. Distinguish the two
  controls in the example and verify the claimed independence with recorded values.
- Change palette while stating and checking its effect on geometry under the chosen seed model.
- Reuse the same positions/headings with a different mark using retained values, without
  rewriting noise sampling or reaching into internal renderer state. This is a proposed
  transfer test, not a claim that the corpus already performed that edit.
- Explain field scale through cited observed changes; do not relabel an unverified knob as
  “organicness” or imply a universally useful interval.

CP1 is incomplete until its contracts, example and edits actually run. Native Processing
execution can establish an early usability prototype; it cannot establish the still-required
p5.js, py5 and Android support. Record target validation separately.

## Concurrent architecture counterexample: paths and their marks

**Decision CP2:** Review [ciserp](../survey/out/2019/generativos/ciserp/notes.md) alongside
CP1 before freezing their shared field/value boundaries. Its positions feed back into a
noise-driven integration loop. Perpendicular strokes, endpoint dots and a faint path trail
are emitted along it. A function that only assigns angles to fixed grid cells cannot replace
this computation, even though both sketches look field-driven.

A useful path result should support drawing the trace itself and attaching different marks
using the needed position/heading/progress information. Exact data shape, update order and
stored-versus-streamed representation remain contract decisions; very long paths make work
and memory part of the design. Sine envelopes, random jitter and palette mixing can remain
editable recipe choices unless repeated use warrants a helper. Do not hard-code a tuft
appearance into a universal flow operation or force the artist to reconstruct integration.

The report's longer perpendicular strokes and altered noise-scale experiments motivate
separate questions about mark extent and path behavior. Their whole-image differences do
not prove isolated causes or a recommended range. Preserve that limitation when teaching.

CP2 is a boundary check now, not permission to implement all flow variants before CP1.
Next select between spacing/packing and cell subdivision according to which opens a useful
new composition with the retained values. Typography is an early substitution/capability
probe; 3D and branching remain deliberate expansion investigations, not forgotten rejections.

## Delivery and ownership

Root reads the decisive evidence, chooses the public boundary and alternatives, writes the
capability decision, and reviews its first complete example. A stronger-model subagent
challenges those choices independently; it does not replace the architect. Luna/Terra
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

# Branching evidence audit: recursive endpoint trees versus mutable line pools

This is a bounded evidence comparison for a possible next artist capability. It makes no
API admission, catalog change, default, range, implementation, or rendering claim.

## Evidence identity

| record | reusable candidate | reviewed position | note SHA-256 |
| --- | --- | --- | --- |
| `2014/Generativos/Arboles#0` | `branchingTree(x, y, h, depth, maxBranch, spread) -> void` | `keep`, `topology.recursive-branch`, reviewed provisional | `36b211ff2b26f54ec5fc6ddccb2eadd681f4aeead3124c50b1aa2752f88d4f69` |
| `2019/generativos/brotes#0` | `branchSubdivide(seeds: Line[], iterations, maxAngle) -> Line[]` | `keep`, `topology.branch-subdivide`, research required | `9a6da7579ae5d3c9d4331181e2e71bd40ab6caa698844b7bc20028c7e8d8fd77` |
| `2018/Generativos/arbolito4#0` | `recursiveBranch(x, y, angle, spread, size, color, depth, branchProbs) -> void` | merge into `topology.recursive-branch`, reviewed provisional | `d9fed9e20763c254e5ae4954995ab721684fdd98222f392dbe895479d1f6c899` |
| `2020/generative/05_08/brotes#0` | `recursiveBranch(x, y, w, h, angle, iterations) -> void` | review required / reviewed defer | `e38db22cb28930889cfbe159d9724fa06d4280c1d4570606bf844138b3a2bdfb` |

The two first records are the comparison subjects. `arbolito4` is a close direct-recursion
neighbour; the later `brotes` is a close attachment-policy neighbour. The current ledger
also binds evidence hashes `6d9b…30dc`, `58cb…05aa`, `2288…be3d`, and `6621…0ce6`,
respectively. Its record-level dispositions remain the authority.

I inspected only the two decisive upstream sources from the local pinned
`AllSketchs` checkout at `69bdd8513e4482a5e6018e36887d4bc208660eb5`:

| source | inspected blob SHA-256 |
| --- | --- |
| `2014/Generativos/Arboles/Arboles.pde` | `918e7de55a6df7f2dcfb25e685775fcddf0eceaf21ce899c6cf6ea89b706c1ef` |
| `2019/generativos/brotes/brotes.pde` | `ac419e8a874e8df82cc1a4d7c1d49d9351ac79e15e1218d1046f6b13ba873549` |

## `Arboles`: immediate recursive endpoint expansion

[`Arboles` notes](../../survey/out/2014/Generativos/Arboles/notes.md) and the inspected
source agree on the central computation. `rama()` first computes and draws one endpoint
segment, shrinks its length, decrements remaining depth, then recursively calls itself for
each selected child. Source lines 58–75 attach every child at the just-computed endpoint,
so a child cannot later revise its parent or a sibling. The recursion stops after the
post-draw decrement makes depth negative (line 67); every entered call has already emitted
a segment.

Child count is gated per entered node. The `probRami` gate is initialized from the
instance stream only when `maxRami > 1` (lines 47–50), and a passing gate selects
`int(random(maxRami)+1)` children (lines 68–71). Child angles are fanned from the parent
angle with another random half-step in the source-specific multiplier formula (line 73).
The source also reseeds the tree's private stream before structural draws (lines 37, 43),
which prevents a simple claim that its tree is compatible with a caller's global Processing
stream. Segment width tapers as a depth function (line 62); that is an emitted-mark attribute,
not proof of a portable topology output.

Measured evidence is narrow but useful for this sketch: changing `maxRami` from its
`random(1,4)` expression to `random(1,7)` was **moderate**, producing a bushier, wider
canopy. Halving the fan multiplier, clamping the sampled depth's lower bound, and increasing
height were **subtle** in this seeded run; changing the blue bounding-frame alpha was **none**
and did not alter the tree. The latter frame is correctly separate from the branching
candidate. These substitutions do not isolate a portable probability law, RNG consumption,
or a useful continuous parameter range.

## `brotes` 2019: iterative, mutable, selected line pool

[`brotes` notes](../../survey/out/2019/generativos/brotes/notes.md) identify a different
state machine. `three()` starts with one `Line` in an `ArrayList` and performs a fixed
90,000 iterations (source lines 80–89). Each iteration selects an existing line with
`int(random(lines.size()) * random(0.8, 1))`, computes its length, and does nothing further when that line is
shorter than four (lines 88–95). Thus iteration budget, selected-pool order, the mutable
`divide` flag, and the short-line skip are observable topology inputs; there is no call-tree
return or remaining-depth stopping rule.

For an undivided line, the source cuts the selected parent at an interior `lerp` point,
mutates the parent's end to that point, and creates three prospective offspring from the
cut (lines 97–127). The actual selection then adds two children for `sel == 1`, one for
`sel == 2`, and none for `sel == 0` (lines 128–147). The repeated `else if (sel == 2)`
branch is unreachable, so the inspected source does **not** establish the report shorthand
“add 1–3 branches” as an exact active policy. For a previously divided line, it again
truncates the parent, appends a continuation line and one angled line (lines 148–168).
Children therefore attach at interior cut positions and their parent geometry is rewritten.
That directly differs from `Arboles`' endpoint-only immutable ancestry.

The report has no completed parameter substitutions for this record: every listed field is
`change: none` with an empty trial/effect. Its narrative values (`sub=90000`, `ampAng=1.4`,
length-factor calls, alpha, and 30 seeds) are source facts, not measured useful controls.
Its “generic stochastic L-system” modularisation wording supports investigation of a
line-pool operation, but it does not erase the mutating worklist semantics above.

## Two close neighbours

[`arbolito4` notes](../../survey/out/2018/Generativos/arbolito4/notes.md) reinforce the
`Arboles` side of the boundary. Its `rama()` emits one segment, shrinks it, stops at a
remaining-depth condition, and independently attempts left, right, and middle child slots
at the endpoint. It reports 0.7/0.7/0.4 child probabilities and depth-dependent angular
spread. Its depth experiment (8 to 12) was **large**, tree-size increase was **large**, and
spread/width changes were **moderate**. Those measurements support depth and attachment
as artist-visible in that separate field composition; they do not identify a common RNG
stream, child-order contract, or recommended range for `Arboles`.

[`2020 brotes` notes](../../survey/out/2020/generative/05_08/brotes/notes.md) is also
recursive, but is a deliberate attachment counterexample to endpoint-only trees. The report
says each child attaches at a random lerp position along its parent's segment, uses 1–3
children, shrinks width and length, and decreases depth by a random 1.1. It additionally
emits shadow and textured quadrilaterals plus joint dots. Its depth and fanout variants were
**subtle**; disc size was **moderate** but changes the backdrop rather than branch topology;
shadow alpha was **none**. This record's current defer status is appropriate: its fractional
attachment and noninteger depth semantics need separate evidence before it can establish a
recursive endpoint-tree contract.

## Boundary findings and unresolved contradictions

- The current evidence supports retaining *two computations for investigation*: direct
  recursive endpoint child expansion (`Arboles`, `arbolito4`) and iterative mutable
  line-pool subdivision (`brotes` 2019). Similar foliage is not sufficient to merge them.
- Parent mutation is the decisive distinction. `Arboles` emits a segment then creates
  descendants from its endpoint; `brotes` selects and rewrites an existing line repeatedly,
  then adds lines from an interior cut. A flat list of output segments alone would conceal
  this difference unless the contract fixes its construction order.
- The existing report prose overstates the active 2019 `brotes` branch count. The inspected
  duplicate `sel == 2` condition makes its claimed 1–3 policy unreliable until corrected or
  re-measured.
- The source-specific `Arboles` fan multiplier and private reseeding, `brotes`' pool-index
  bias and 90,000-attempt budget, and both sketches' rendering/style layers are evidence
  gaps for any portable stochastic/environment contract. None supplies a public default,
  broad recommended range, or a host-compatible RNG promise.

## Root source review correction

Root read both decisive source loops directly after the audit. The current `brotes` index
expression samples the whole index interval and multiplies it by a factor below one; it
does not sample only the last 20% of the list. The earlier audit and note's “end-biased”
description must not be used as a scheduling contract. In the ideal continuous model,
its pre-floor expected index is N × 0.5 × 0.9 = 0.45N, below whole-list uniform 0.5N.
This is an analytic observation, not a measured native index histogram.

The source's cut fraction is also `random(random(0.6,0.7), random(0.8))`, not a plain
uniform 0.6–0.8 draw. Host behavior when its sampled upper bound is below its lower bound
must be included in a future source-matching investigation. The `Arboles` stop is depth
less than zero after decrement, so the report's stop-at-zero shorthand misses one emitted
level. These corrections reinforce keeping exact source state machines separate before
any reusable branching contract; no branching API is admitted here.

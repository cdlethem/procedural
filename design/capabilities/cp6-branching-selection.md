# CP6 selection after the private comparison

Root accepted the eight-image investigation in
[evidence/parameter-experiments/cp6-branches/root-review.json](../../evidence/parameter-experiments/cp6-branches/root-review.json).
This document supersedes the earlier investigation direction where they differ. The original
experiment, source and direction remain frozen as evidence of what actually ran.

## Admit the capability, course-correct the growth order

Retained endpoint branching is useful: the comparison shows a broad forked structure and a
narrow binary spray through the same expansion kernel, independent generation colours,
length-based taper and actual terminal markers, and transfer to existing placed roots.
The result must retain ancestry, generation and actual child counts alongside geometry.
These prevent artists from rebuilding a tree by comparing floating coordinates.

The source-like depth-first shared stream is a poor default for the intended depth control.
Its shallower example rearranges later sibling branches rather than simply removing deeper
descendants. This is not an implementation bug: recursive subtree draws shift subsequent
sibling gates and angles. Merely documenting that surprise would miss an opportunity to make
an early architectural decision better.

Select breadth-first ordered expansion for the public candidate, subject to the independent
prefix diagnostic. Append the root first; visit retained parents in increasing index order;
append their successful children in declared slot order. Adding generation rules at the end
must preserve every previously generated segment's geometry, parent index and generation.
The former leaves may gain children, so child counts and terminal styling can change. Do not
promise whole-output prefix equality. This is a deliberate divergence from source DFS and
its draw order, with technique-level rather than source-pixel reproduction as the target.

An iterative retained list also serves as the traversal queue. It avoids host recursion and
makes the working storage and output ordering easier to explain and bound. A node limit
must fail explicitly rather than return a truncated tree masquerading as complete output.
Exact limit/error/numeric semantics still belong in the future contract.

## Prefer data describing generations over named botanical presets

The comparison supports generation-dependent spread: narrower later angle ranges visibly
align terminal twigs while retaining the same topology. Keep this expressiveness in explicit
generation rules, not a permanent “arbolito” mode or an opaque host callback. The initial
public candidate should have one computation: seeded endpoint expansion from an ordered
sequence of generation rules. A fixed-rule tree is the repeated-rule case in the editable
example; do not add a second public alias just to avoid a short list construction.

Candidate rule responsibilities are a shared-per-parent child-length scale interval and an
ordered set of probability/relative-angle slots. This is enough to express the demonstrated
two/three-slot substitutions. Style, palette, terminal marks and forest/root placement remain
example composition. No hidden colour draws belong in the geometry stream. Source nested
length laws, node-gated random child counts and mutable/interior branching are not silently
merged into this model.

A rule sequence naturally makes the number of growth transitions explicit. The contract must
settle whether its length alone determines that number; avoid a redundant depth field that
can disagree with the rules. The plain Java example should construct the sequence in a few
readable lines and make uniform versus changing spread easy to edit. If that is burdensome,
revise the composition entry point before freezing an API, not after shipping a cumbersome
parameter object.

## Remaining concrete design work

First prove same-input replay, geometry/ancestry prefix under appended rules, and invariance
of earlier levels when only later rules change. The no-render BFS diagnostic is evidence
for this ordering decision, not a public implementation. Then admit the exact dependency
against arbolito3/arbolito4 candidates with remainder accounting, and define the contract:
root representation, rule/slot fields, private portable RNG, draw consumption, finite and
collapsed geometry, safe work/storage limits, dynamic failure, detached result access,
trigonometric tolerance policy and distinguishing fixtures. No public signature or Java
library implementation has been approved yet.

# BranchMarks

Start here when your idea needs a trunk that produces endpoint branches, a narrow spray,
or a group of trees whose marks you can change after growing them. `BranchTree2D` handles
the expansion, random decisions, stopping and ancestry. You supply a root and rules for
successive generations; ordinary Processing code draws the returned segments.

The editable files are
[BranchMarks.pde](../packages/java-processing/examples/BranchMarks/BranchMarks.pde) and
[BranchComposition.java](../packages/java/examples/BranchMarks/BranchComposition.java).
The composition builds geometry; the PDE chooses colour, line weight and tip marks.

## Shape the growth

Begin with the root's position, heading and length. Heading is in radians; negative
`PI/2` points up on a conventional screen. Each generation rule has a `lengthScale`
interval and ordered child `slots`. A slot gives a probability and a relative `turn`
interval. The two side slots can both succeed, both fail, or produce one child. The
third slot is another independent opportunity, not a guaranteed central trunk.

A parent's children share one sampled length scale. Each successful slot samples its
own turn. Removing the third slot produces a different branching policy; narrowing
the turns produces a different direction pattern. Neither edit requires rewriting the
tree-building algorithm.

| Key | Edit |
| --- | --- |
| N | Append/remove one generation rule |
| G | Fixed spread / spread that narrows with generation |
| W | Ordinary / wider turn intervals |
| B | Three child opportunities / two narrow side opportunities |
| R | Advance the explicit seed |
| X | Single root / roots supplied by circle placement |
| C | Change the generation palette without rebuilding geometry |
| M | Thin lines / length-based taper with actual terminal dots |
| 0 | Reset the example |
| S | Save the displayed canvas |

These controls use authored example settings. They are not API defaults or measured
recommended ranges. The full rule data is in `BranchComposition.rules`; edit it directly
to give different generations different turns or probabilities.

`N` leaves existing rule values unchanged. The operation visits parents breadth first,
so appending a rule preserves earlier segment coordinates and ancestry. Former tips may
grow children, and their terminal dots can disappear. If your own rule expression divides
by the total generation count, changing that count also changes earlier rules and loses
this preservation. Earlier gate/slot edits may also shift subsequent random choices.

## Draw your own marks

Traverse `tree.size()` and copy each segment into a reusable four-number buffer with
`segmentInto`. The coordinates are start x/y then end x/y. `lengthAt` supplies the nominal
length for taper; `generationAt` supplies an absolute level for colour or mark selection.
`parentAt` gives ancestry without comparing floating coordinates. A segment is an actual
terminal when `childCountAt(i) == 0`, including branches that stopped early.

The result retains geometry independently of rendering. Change the PDE's `draw()` loop
to use your own marks, or draw the same tree in several layers. Palette and mark controls
in this starter retain the exact same tree objects. Root placement, clipping, canopy
spacing and drawing are explicit composition decisions. Circle exclusion in the forest
mode reserves space around roots; it does not prevent branches from overlapping.

The single-tree example uses seven transitions, or eight with `N`. The smaller forest
trees use five, or six. Both schedules stay below an example-wide worst-case budget of
20,000 segments. The public operation requires `maxSegments` and fails explicitly if a
successful child would exceed it; it never returns a silently truncated tree. This cap
bounds retained nodes, not all input validation or failed slot visits.

## Evidence and limits

[arbolito3](../survey/out/2018/Generativos/arbolito3/notes.md) and
[arbolito4](../survey/out/2018/Generativos/arbolito4/notes.md) motivate endpoint branching,
shared child length and generation/terminal styling. Their measured depth and spread
edits show impact, but do not establish portable recommended ranges. The source audit
corrects arbolito4's note: its three gates allow zero through three children, and the
source's spread is wider near the root, not near the tips.

This operation deliberately uses a private portable RNG and breadth-first expansion;
it does not replay the sketches' global Processing random stream or depth-first order.
It does not implement interior attachments, cuts into a mutable line pool, or a symbolic
L-system. Those are separate computations, not hidden modes of this generator.

See the [contract](../catalog/operations/seeded-endpoint-branches.json) for exact data,
error and numerical rules, and [review](../design/operations/branch-tree-contract-review.md)
for the accepted semantics and remaining delivery obligations. Other target ports are deferred.

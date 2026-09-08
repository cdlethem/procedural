# CP17 direction: irregular rectangular layouts

Status: root reviewed admission and contract direction after the private native experiment.
Normative semantics: `design/operations/binary-cell-partition-contract.md`; schemas and
shared fixtures: `catalog/operations/binary-cell-partition-2d.json` and its fixture path.
No implementation, native workflow or distribution acceptance follows from this decision.

Artist task: divide a surface into unequal panels, then reuse the same retained panels
for nested outlines, fills or other ordinary drawing. The package should remove the
recursive layout algorithm while keeping cell decoration in the sketch.

The existing `layout.seeded-quadrant-partition-2d` replaces a leaf with four equal
quadrants. It cannot express an arbitrary two-way cut without bespoke geometry logic.
Root selects binary rectangle partitioning as the next bounded Java investigation.
This is a design priority, not a claim that subdivision is the largest remaining gap.

## Decisive evidence

- `survey/out/2018/Generativos/poop/notes.md`, candidate #0: integer-cell rectangular
  subdivision followed by alternating nested rectangles. Root read the pinned source at
  upstream revision `69bdd8513e4482a5e6018e36887d4bc208660eb5`,
  `2018/Generativos/poop/poop.pde`. Each attempt chooses a live leaf and an axis;
  an undersized selected axis consumes an attempt without splitting. Successful children
  append before parent removal. Cut selection truncates Processing random(1, extent-1),
  including its special equal-bound behavior at extent two. Do not silently describe
  this as uniform selection across every interior integer boundary.
- `survey/out/2018/Generativos/barab/notes.md`, candidate #0: random live-leaf selection
  and long-axis binary cuts. This supports reuse beyond one decorative recipe; axis
  policy differs from poop and must be resolved explicitly before freezing a contract.
- `survey/out/2018/Generativos/pliegues/notes.md`: unequal four-child splits, with measured
  subdivision-count changes. This is a counterexample to merging all rectangle
  subdivision candidates into one computation, not evidence for binary-cut defaults.
- `survey/out/2019/generativos/griton/notes.md`: biased selection and more involved
  subdivision/deletion. Its measurements must not be borrowed as binary partition ranges.

## Next bounded work and acceptance boundary

Root resolved integer coordinates, RANDOM/LONGEST axis policy, attempted split counts,
one-cell minimum extent, survivor-then-child ordering and exact private stream consumption.
The native investigation supports these two policies without adjustable probabilities.
No useful parameter range is established by the two reports' empty experiment lists.
Example settings can be authored settings, explicitly distinguished from measured ranges.

The language-neutral contract and21 shared fixtures are frozen before delegating Java code.
Reuse existing seeded stream, validation, packaging and native render infrastructure.
Review coverage/area conservation, non-overlap, degenerate bounds, stable ordering,
determinism and bounded work with focused checks. A native panel workflow must demonstrate
a structural edit and reuse unchanged cells with a different decoration.

Do not claim a full original recreation until every defining source algorithm and the
declared reproduction criterion have been checked. No new operation is shipped yet.
Ports and Sol remain paused; root retains architecture and final acceptance ownership.

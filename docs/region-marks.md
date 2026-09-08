# RegionMarks

Divide a surface into cells, then decide what belongs inside each cell. This Processing
starter keeps its generated rectangles while you change their palette or replace a single
central mark with a small field of marks.

The local Java 0.4.0 package passed core conformance, installed Processing execution and
direct visual review. Follow the [installation guide](installing-region-marks.md). Other ports
are deferred; this is not a public registry release.

## Begin with cells

Open [RegionMarks.pde](../packages/java-processing/examples/RegionMarks/RegionMarks.pde)
and its editable [RegionComposition.java](../packages/java/examples/RegionMarks/RegionComposition.java)
tab. The seeded configuration supplies a 640×640 rectangle, seed 42, 100 replacements and
selection fraction 0.5. Those numbers describe this piece, not library defaults or a
recommended interval.

`QuadrantPartition2D.generate` owns the repeated selection and splitting. Each successful
replacement removes one rectangle and adds four quadrants, so 100 replacements leave 301
cells. It returns bounds and creation IDs, with no drawing or styling.

| Intention | Key | Result |
| --- | --- | --- |
| Make the layout finer | N | Toggle 100/200 replacements and regenerate the cells |
| Change which cells can be refined | G | Toggle selection fraction 0.5/1 and regenerate |
| Try a new arrangement | R | Advance the explicit seed |
| Put a field of marks inside each cell | M | Toggle one central dot or a 3×3 grid; keep cells |
| Recolour the piece | C | Change palette; keep cells |
| Draw inside your own regions | X | Switch to the editable eleven-cell grid arrangement |
| Save this piece | S | Save the displayed cached canvas |

N, G and R apply to the generated arrangement. In the authored arrangement, edit the ordinary
cell list in the Java tab. X switches back as well. All style controls apply to either layout.

## Understand selection and identity

The operation maintains an ordered list of live cells. New children are appended after
older surviving cells. Fraction 0.5 samples a fractional prefix of that list; fraction 1
makes the whole list eligible. This is a selection rule based on list order, not a sort by
area or a fixed spatial direction. Full-list selection can repeatedly refine newly born
cells while leaving older large cells untouched.

Increasing replacements continues the same split history, but replaces some former leaves.
The final list is not a prefix of the previous list. An unchanged surviving cell keeps its
creation ID, so using that ID for colour keeps its appearance independent of list position.
IDs belong to one generation history; different seeds need not identify corresponding cells.

Bounds are `[left, top, right, bottom]`. Width is `right-left`, height is `bottom-top`.
Use `boundsInto(index, buffer, 0)` to traverse without allocating a new array for every cell,
and `idAt(index)` for the creation identity. `boundsAt` and `toValues` give detached copies.
Retain your configuration if you want to reconstruct the same arrangement later.

## Replace content or replace the layout

The sketch's drawing loop consumes ordinary bounds. Change the panel, mark or content
without changing the partition operation. The small mark field reuses `RegularGrid` in
normalized cell coordinates, then scales each position into the current rectangle.

The authored example makes a 2×3 grid and refines one of its cells into another 2×3 grid.
It supplies those bounds to the same content code. That small explicit arrangement stays
editable example code; the library does not introduce a second refinement API for it.

The seed, replacement count and selection fraction govern geometry. Content and palette
consume no layout randomness. The sketch uses a small proportional inset so tiny panels
remain positive-sized; that drawing choice is not a partition parameter.

## Evidence and limits

The operation is motivated by
[mosaic02](../survey/out/2018/Generativos/mosaic02/notes.md) and
[mosaic](../survey/out/2018/Generativos/mosaic/notes.md). Independent cell content also
appears in [chinasseForms](../survey/out/2017/Generativos/chinasseForms/notes.md), whose
variable-grid generator is a different computation.

Root inspected a five-image private investigation of count, selection and content edits;
its [decision](../evidence/parameter-experiments/cp4-regions/decision.md) records the exact
settings and results. The package uses a separately specified portable random stream, so
those images are technique evidence, not exact images promised by this public generator.
The [architecture decision](../design/capabilities/cp4-architecture-decision.md) also records
a conflict between the survey's selection description and independently checked source
behavior. This guide does not repeat the disputed direction as a guarantee.

Every requested split must have representable interior midpoints. If a region is too small
to split in binary64, generation fails explicitly and returns no partial result. More work
also costs more memory and ordered-array movement; start with the example's finite settings
and retain the generated cells for style edits. No continuous encouraged range, maximal
refinement, source-pixel reproduction or full-corpus coverage is claimed.

The [installed native review](../evidence/reproductions/cp4-java2d/root-review.json) records
11 states and key events, exact retained geometry, reset replay, authored-cell transfer and
cached save. Three public-stream images were inspected directly.

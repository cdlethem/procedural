# LatticeMarks: draw an occupied path arrangement

LatticeMarks is an editable Java starter built around `OccupiedLatticePaths2D`.
Supply ordered lattice starts, grow orthogonal paths, and draw the retained result as lines
or dots. The core and the Processing JAVA2D workflow have scoped acceptance.
See [installation](installing-lattice-marks.md) to open the example.

## Start with an arrangement

The operation works in integer cells. A caller supplies the lattice dimensions, ordered
start cells, a successful-move limit, a work ceiling, and an explicit seed or random state.
The starter uses a 24×24 lattice mapped to a 640×640 canvas. Its 36 possible
starts are the cells at indices `2, 6, 10, 14, 18, 22` on each axis, visited in the
authored order `(13 * i) % 36` so the first few starts spread across the canvas. It begins
with 12 starts and a 12-move limit; 36 starts and 36 moves are alternate authored settings.

Each available start is emitted and claimed before its path moves. Every successful move
claims one unoccupied north, east, south, or west neighbour. A start already claimed by an
earlier path produces an empty path with an `occupied-start` reason. A path that reaches its
move limit reports `step-limit`; one with no available neighbour reports `blocked`.
The occupancy belongs to the whole call, so later paths see the cells claimed by earlier
ones. This makes the ordered start list part of the composition.

Longer paths can therefore leave fewer visible paths. In the planning oracle, the baseline
12-start/12-move arrangement emitted 155 cells across 12 nonempty paths. Raising only the
move limit to 36 emitted 245 cells but left 8 nonempty paths: four later starts were already
occupied. Starting again from baseline and raising only the start count to 36 emitted 342 cells
across 28 nonempty paths. Changing only the baseline seed to 43 emitted 156 cells across
12 paths. These [oracle counts](../design/capabilities/cp11-lattice-marks-acceptance.md#root-pre-implementation-geometry-check)
describe the planned authored inputs, not a guaranteed coverage rule or a recommended range.

The operation is an arrangement generator, not a maze solver or route planner. It does not
promise maximal packing, shortest routes, full coverage, or the requested number of visible
paths. Empty occupied starts and shorter blocked paths are useful information for deciding
how an arrangement feels.

## Keep geometry while changing the treatment

The first treatment draws each nonempty path as a thick orthogonal stroke with a
small offset shadow and contrasting endpoint dots. A one-cell path is still useful: draw it
as a dot rather than assuming every path contains an edge. A second treatment draws coloured
dots at the same retained vertices. Switching between these treatments reuse the
same path object, occupancy result, and structural random state. It do not resample the
arrangement.

This separation lets you make a quiet line study, then try a dotted or palette-driven piece
without moving any cells. Cell-to-pixel mapping, shadow offsets, stroke widths, endpoint
marks, and palette choices belong to the drawing layer. The core operation owns paths and
occupancy only; style randomness does not alter the path arrangement.

## Editing controls

These controls describe the starter interaction. They are example editing choices,
not library defaults or recommended settings.

| Key | Edit | Geometry |
| --- | --- | --- |
| `C` | Change the palette | Retained |
| `M` | Cycle connected paths or vertex dots | Retained |
| `W` | Toggle authored stroke width, 0.35/0.65 cell units | Retained |
| `L` | Toggle the authored successful-move limit, 12/36 | Regenerates |
| `N` | Toggle authored start count, 12/36 | Regenerates |
| `R` | Advance the explicit unsigned-32 seed | Regenerates |
| `0` | Restore seed 42 and baseline settings | Regenerates |
| `S` | Save the completed cached canvas | No new generation |

Use `C`, `M`, and `W` when the arrangement is right and the visual language needs to
change. Use `L`, `N`, or `R` when you want to change the arrangement. Resetting with `0`
is useful for comparing treatments against the same baseline; saving with `S` preserves
the displayed result without another generation.

The 24×24 mapping, 12/36 counts, 12/36 move limits, start ordering, seed 42, palette,
stroke widths, shadows, and dot sizes are authored starter settings. The operation has no
defaults or encouraged continuous ranges established by the evidence. The source sketches
that motivated this capability show that path count and length can affect a composition,
but their different random starts, retry behavior, and emission rules do not establish
portable numeric recommendations for this changed operation.

For the exact input, output, occupancy, completion-reason, random-state, ownership, and
work-limit rules, see the [occupied lattice paths catalog entry](../catalog/operations/occupied-lattice-paths-2d.json).
The [CP11 decision](../design/capabilities/cp11-lattice-decision.md) records why explicit
starts and shared call-local occupancy are central to this capability.

# CP17 private experiment specification

This is a frozen specification for a private parameter/capability experiment, not an
approved public contract. Do not add it to the catalog or distribution yet.

Independently implement integer-cell binary partitions. Inputs: uint32 seed, positive
integer columns and rows (at most 2147483647 each), nonnegative integer attempts (at most
2147483646), axis policy RANDOM or LONGEST. Root bounds are [0,0,columns,rows]. Artists
translate/scale integer bounds in ordinary sketch drawing. No float-coordinate mode,
minimum-size option, selection bias, adjustable axis probability or callback.

Use the established xoshiro128** 1.1 / SplitMix64 seed expansion and unit mapping in
QuadrantPartition2D. Reuse its package-private nested stream in the private diagnostic's
org.procedurals.layout package. No public RNG refactor is authorized for this experiment.

On each attempt: consume one unit, select floor(unit * liveCount) from the current ordered
leaves. RANDOM consumes another unit; <0.5 selects width, otherwise height. LONGEST consumes
no axis draw: width only when width>height, height on ties. If the selected extent is one,
consume no cut draw and leave the sequence unchanged. Otherwise consume one unit and cut
at 1+floor(unit*(extent-1)), relative to the selected lower bound. This deliberately admits
every interior integer cut and consumes a cut draw even for extent two. It does not claim
Processing stream compatibility. Both choices differ from source quirks, explicitly.

Remove the selected leaf, preserving the order of all survivors, then append the lower
coordinate child and upper coordinate child. Final count = successful splits+1, not
attempts+1. Do not retry failed attempts, switch axes after failure, or early-exit at
saturation (stream consumption remains specified). All output coordinates are exact
nonnegative integers. Output bounds are detached; retain successful split count separately.
No IDs or tree-history API needed for this experiment.

Private Java prototype: BinaryPartitionProbe.generate(seed,columns,rows,attempts,policy),
returning retained immutable layout with size(), splits(), boundsAt(index) (fresh int[4]),
and boundsInto(index,int[4]) for no-allocation drawing. Invalid input throws
IllegalArgumentException; invalid index IndexOutOfBoundsException. Validate before writes.
Dynamic storage must grow with actual successful splits, not requested attempts. Ordered
array removal may be O(attempts * liveLeaves); document and measure before public adoption.

Private native sketch PanelStudy: 640x640 JAVA2D density1, supplied seed and numeric params
attempts (integer), policy (0 RANDOM /1 LONGEST), decoration (0 nested outlines /1 inset
flat panels plus center line). Use configureRender(long,Map<String,Double>) with the
existing render_java.py helper. Use 60x60 cells, 10 pixel scale, origin20. Fixed per-index
palette; style never changes the generated layout. Example attempts20/80/240 are investigation
settings, not recommendations. No rendering inside the core; no copied upstream code.

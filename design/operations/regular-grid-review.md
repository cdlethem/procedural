# Regular grid: operation admission review

Owner: root. Status: admitted by root after Sol review; contract clarifications below are resolved.
Capability: [CP1](../capabilities/cp1-field-marks.md), reusable positions independent of marks.

## Source membership and scope

`2017/Generativos/circlesAlpha#0` is the clearest whole-computation representative: its
report describes a `(cols+1)*(rows+1)` point lattice spanning the canvas. The count names
are cell counts there; the library uses explicit point counts, with caller conversion
`columns = sourceCols + 1`, `rows = sourceRows + 1` and matching pitch. This is an explicit
interface conversion, not a claim that point count and cell count mean the same thing.

`2019/generativos/paraisooscuro#3`, the old family representative, mixes an n-by-n lattice
with ADD point rendering. Retain only regular placement evidence; drawing, opacity, ADD,
and the randomized resolution belong to the example/adapter. The report does not establish
exact endpoint inclusion or float operation order. Do not freeze those by inference.

`2018/Generativos/pelines#0` supplies CP1 motivation but is not a whole-operation merge:
its independent heading/length/colour sampling and marks remain separately accounted for.
Its extent/pitch loop can be expressed with point counts after explicit bound conversion.
Do not silently implement source float repeated-addition in this portable grid.

Related triage includes snapped random scatter (`walking_gradient#1`, `pelican#2`),
3D lattices (`lulu#1`), noise-displaced points (`cubitos#0`), random thinning (`carnaza#0`,
`grillsss#1`), and compound dot/halo/shadow drawing. None is automatically a grid merge.
This operation returns all 2D regular positions in its declared domain, without random
selection, displacement, symmetry, styling or pixels. Those families remain unresolved.

## Concrete behavior proposal

Input is one parameter object with required `origin: [x,y]`, `spacing: [dx,dy]`,
`columns`, and `rows`. No defaults. Origin is a supplied coordinate, including negative
overscan; spacing is strictly positive in the same caller coordinate units. Columns and
rows count points, not cells. They are integers in [0, 2147483647]. Their product must not
exceed 9007199254740991 so every flat index and count is exactly portable through JSON/JS.
These are chosen representation bounds, not measured artistic ranges or recommended counts.

Result is an immutable, indexable regular-point sequence. JSON interchange describes it by
`origin`, `spacing`, `columns`, and `rows`; `size` is computed and never serialized. It is a compact value, not a persisted
recipe, function closure or eager array of point objects. Semantic indexed access returns a binary64 coordinate pair; a native output-buffer overload
is an optional optimization with its own storage validation. No float32/PVector conversion
is permitted in the exact binary64 route. Ordinary iteration is allowed.
The result does not alias mutable input storage. No RNG, noise, time, assets or renderer.

For valid flat index i (integer, 0 <= i < size), let column = i mod columns,
row = (i-column)/columns using exact integer semantics. x changes fastest: row-major order.
Coordinates are `x = origin.x + column*spacing.x`, `y = origin.y + row*spacing.y`.
Each multiply rounds to binary64 before the add rounds to binary64, ties-to-even;
no fused multiply-add and no repeated addition. Convert indices to binary64 exactly.
Normalize descriptor origin/count zeros and result coordinate zeros to positive zero. Coordinates compare exactly across targets because
this operation uses only the specified basic arithmetic, not transcendental functions.

The descriptor's geometry extends to the last emitted point, not to an implied cell edge.
Count 1 emits the origin along that axis. Either count 0 yields size 0; there is no valid
index. No divide-by-zero during valid use. Negative/zero/nonfinite spacing is invalid even
for an empty sequence. Inputs containing NaN/infinity/bools as numbers, wrong vector shape,
missing/unknown fields, nonintegral counts or representational overflow are invalid.

For a nonempty grid, validate both final-coordinate calculations for finite output before
returning the descriptor. Positive spacing makes these the extrema; invalid endpoint
arithmetic returns an error without partial output. For an empty grid no endpoint exists,
so no coordinate extent is evaluated. Adjacent points may coincide due to binary64
resolution at huge origins; that is specified rounding, not a reason to invent an epsilon
or silently adjust spacing. Document this numeric limit and test it.

Error precedence: input shape/type/domain -> count-product bound -> coordinate overflow.
Indexed access validates a safe integer index then bounds, before touching caller storage;
invalid access must leave that storage unchanged. Stable error codes and native exceptions
will be entered in the contract. Descriptor creation/access are O(1) time/space; traversing
all points is O(columns*rows). No mandatory materialization or output-sized allocation.

## Why this shape

A count-and-pitch core removes floating loop-termination ambiguity and keeps cardinality
exact across languages. A native bounds-and-spacing convenience may compute counts later,
but no universal half-open/closed policy is hidden here. An artist can retain positions,
change marks, and reuse the grid for selection without repeating layout logic. Emitting
line/dot commands here would prevent that substitution.

The compact sequence keeps CP1's quarter-million positions inexpensive to describe and
lets adapters/examples request points as needed. Packed retained mark attributes remain a
separate CP1 representation decision. This is not approval to create a generic lazy graph.

## Distinguishing fixtures planned

- 3 columns × 2 rows with unequal spacing and negative origin: all six coordinates/order.
- One row, one column, and zero counts independently.
- A 3-cell source grid maps explicitly to 4 points per axis (circlesAlpha).
- A nonempty grid with overflowing final multiply/add fails before iteration.
- An empty grid with large unused spacing remains empty after structural validation.
- A cancellation case distinguishes separate multiply/add from FMA; decimals distinguish
  direct indexed evaluation from repeated addition.
- High flat index exercises exact decomposition and distinguishes float32, nearest-rounded quotient and 32-bit narrowing errors; no binary64-floor counterexample is claimed.
- Input and caller-output mutation/ownership, negative zero, wrong types and index errors.

These are mathematical/structural reproduction fixtures; no raster image proves these
semantics. CP1 rendering and four-target native integration remain required downstream.

## Sol review resolution

Root accepted Sol’s six clarifications: serialize only canonical parameters and compute size;
separate semantic point access from optional native output buffers; normalize descriptor zeros;
use overflow-safe exact integer count/index operations; define deterministic validation order;
and state the source conversion preconditions. For a source positive cell count c and span s,
point count is c+1 (within int32), pitch is binary64 s/c; this is example conversion, not a
hidden policy. Shape validation precedes domains; validate origin x/y, spacing x/y, columns,
rows; product then endpoint x/y; index type then bounds then optional output storage.
No general output-list allocation, noise, RNG or renderer behavior is admitted here.

## Implementation review — Sol, 2026-09-07

Sol independently reviewed the Java, JavaScript and Python cores and native harnesses.
Root resolved three findings: lossy Java Number coercion could admit fractional counts or
indices; JavaScript output slots were more restrictive than the transport contract; and
serialization/positive-zero checks had coverage gaps. Java now declares supported boxed
numeric classes, JavaScript permits ordinary writable slots regardless of old contents,
and both Java and Python verify canonical descriptor and coordinate zeros. Regression
checks and all shared cases pass. Sol checked the final evidence hashes and reported no
remaining material correctness or false-validation blockers.

This review approves the current portable core scope only. It does not approve Processing,
p5.js, py5 or Android host integration, complete CP1 rendering, or full-corpus reproduction.
The generated run is `evidence/conformance/regular-grid.json`; refresh through its tool.
Root also integrated Sol's build hygiene follow-up: the runner cleans its dedicated generated
Java build directory before compilation, preventing stale classes from entering later JARs.

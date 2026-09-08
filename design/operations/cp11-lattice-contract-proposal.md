# CP11 occupied-lattice-paths contract proposal

**Status:** proposal for one root review; no catalog entry, fixture, implementation, or
support claim follows from this document. The approved capability decision is
[`cp11-lattice-decision.md`](../capabilities/cp11-lattice-decision.md). Evidence is bound
to [`cp11-lattice-evidence.md`](../capabilities/cp11-lattice-evidence.md), revision
`survey/snapshot.json` as checked in for that review, and the motivating candidate
`2019/generativos/tata#0`: note SHA-256
`66d58d804843d0aeda177cc6f32405078e4bcb7ab8f5812424f47c9dabb795a2`,
source SHA-256 `7e7090ed7525f87e75c5d3bbba4ea77b046416ded31e24f3a653d76ead558d37`,
and candidate-evidence SHA-256
`45447ac269b308ceba89d8b6e21066f75169ae05c4b8311c63172300471d571b`.

## Proposed identity and artist-facing result

`path.occupied-lattice-paths-2d` 0.1.0 is the proposed generator and approved cluster
identity. It turns deliberate ordered
start cells into retained, non-overlapping orthogonal cell paths. A caller can map those
integer cells through an existing grid or its own coordinate transform, then restyle the
same paths without regenerating them. It computes neither a grid drawing nor a maze,
router, session, renderer, callback, clock, graph, trail, or coverage guarantee.

This extracts tata's shared destination-occupancy burden while deliberately changing its
omitted start, four-retry, and failed-round behavior. Tata supports why shared occupancy
matters; it does not establish equivalent paths, random consumption, or pixels. Guagua
is not a member: its walks may revisit cells, leave bounds, emit before moving, and do not
use its allocated `used` grid. Its deferred candidate remains separate.

There are no defaults, encouraged ranges, palette/style inputs, or source-derived public
probability controls. Tata's measured `cc`, walk count, and requested walk length showed
whole-piece visual changes, but are not ranges for this changed computation.

## Portable input and output

The proposed JSON-compatible input record has exactly six keys:

```json
{
  "dimensions": [columns, rows],
  "starts": [[x, y], "..."],
  "maxSteps": 0,
  "maxCells": 0,
  "random": { "seed": 0 }
}
```

`dimensions` is a two-element positive integer pair; `columns` and `rows` are each in
`1..2147483647`. Coordinates are integer cell indices with origin at the north-west
cell, x increasing east and y increasing south. Every `starts` pair is a finite integer
in its corresponding half-open dimension. The ordered list may be empty and duplicates
are valid. `maxSteps` is a nonnegative integer: the maximum number of *successful moves*
after an available start, never a requested output length. `maxCells` is a nonnegative
integer global capacity explained below. Booleans, non-integral numbers, nonfinite values,
missing/extra keys, arrays in place of records, and passive-container violations are
invalid input under the project’s established carrier conventions.

`random` has exactly one key. `{"seed": uint32}` begins the existing portable stream
from the specified expansion. `{"state": [s0,s1,s2,s3]}` begins from four uint32 words
in that exact order, excluding the all-zero state. The first form gives seeded replay;
the second accepts an earlier returned state for deliberate continuation. There is no
host RNG, Processing seed, style stream, default seed, or implicit global state.

The output record is:

```json
{
  "paths": [[[x, y], "..."], "..."],
  "completionReasons": ["step-limit", "..."],
  "randomState": [s0, s1, s2, s3]
}
```

`paths` and `completionReasons` have one item for every supplied start, in input order.
Each path is either empty only for `"occupied-start"`, or begins with its supplied start.
For a nonempty path, every cell is unique across the entire output and adjacent cells
differ by exactly one cardinal unit. A reason is exactly one of `"occupied-start"`,
`"blocked"`, or `"step-limit"`. `randomState` is the private stream state after the last
choice the call actually consumed; it is detached output, not a retained session.

Inputs are never mutated. Output lists, pairs, state and every native accessor carrier
are detached. Occupancy and retained packed cells belong to one returned result and never
survive into another call except through an explicitly supplied `random.state` carrier.

## Generation, order, and deterministic stream

Validate the complete record, every start, integer bound, and the potential-cell bound
before initializing randomness, allocating output-sized storage, or claiming occupancy.
Then process starts in order with one local sparse occupancy set:

1. If the start is already occupied, append `[]` and `"occupied-start"`. Consume no RNG.
2. Otherwise append the start to this path and the retained output, and claim it in the
   shared set immediately. If `maxSteps == 0`, append `"step-limit"` without enumerating
   a neighbour or consuming RNG.
3. For each move while fewer than `maxSteps` successful moves have been made, enumerate
   in-bounds, unoccupied neighbours in **north, east, south, west** order. If none are
   available, append `"blocked"` and consume no RNG.
4. Otherwise consume exactly one xoshiro unit, including when exactly one neighbour is
   available. Let `selected = floor(unit * availableCount)`; append and claim that indexed
   candidate. Repeat. Reaching the successful-move limit appends `"step-limit"`.

The stream is the existing portable **xoshiro128** 1.1 mapping used by
`CirclePlacements2D`, `BranchTree2D`, and `QuadrantPartition2D`: a uint32 seed is
zero-extended to uint64, expanded by two successive SplitMix64 increments and outputs,
and packed as `[low32(q0), high32(q0), low32(q1), high32(q1)]`. One xoshiro output is
`rotl32(s1*5,7)*9` modulo 2^32 followed by the established xor/shift/rotate transition;
the unit is its unsigned value divided by 4294967296. A supplied state bypasses only the
seed expansion, not that output/transition. The state returned after a one-option choice
therefore differs from the input state. No random output is consumed for an occupied
start, a zero-step available start, or an actual blocked step.

All arithmetic in the walk is checked signed-integer arithmetic. The specified dimensions
make a valid coordinate and its in-bounds cardinal neighbour representable as signed32;
the occupancy key is a canonical ordered pair of those two integers, never a lossy
floating encoding. No epsilon, rounding, clamping, retry, replacement proposal, or
partial result is permitted.

## Capacity, failures, and native surface

`maxCells` is a required static resource bound, not an artistic parameter. Require
`starts.length * (maxSteps + 1) <= maxCells <= 357913941`, using checked wider integer
arithmetic. This bound admits every possible output before RNG, gives packed two-scalar
cell storage a signed32 indexable length, and bounds neighbour tests by
`4 * (maxCells - starts.length)` plus ordered start checks. Sparse occupancy remains
O(actual emitted cells), so a large representable rectangle never allocates a whole-grid
boolean array. Host allocation failure is a host failure, never an operation error or a
partial result.

Proposed stable errors are:

- `INVALID_INPUT` — malformed carrier/key, random carrier, dimension, start, `maxSteps`,
  `maxCells`, or all-zero random state.
- `WORK_LIMIT_EXCEEDED` — valid fields whose checked potential cell count exceeds
  `maxCells`; emitted paths and RNG state do not escape.
- `INVALID_INDEX`, `INDEX_OUT_OF_RANGE`, `INVALID_OUTPUT` — native accessor and `Into`
  precedence, following retained-geometry conventions.

The Java reference shape is `org.procedurals.paths.OccupiedLatticePaths2D.generate(Object
config)`. Its exact proposed accessors are `pathCount()`, `pathLengthAt(Object|long)`,
`cellAt(Object|long path, Object|long cell)`,
`cellInto(Object|long path, Object|long cell, int[] output, int offset)`,
`completionReasonAt(Object|long)`, `randomState()` (fresh four-int carrier), and
`toValues()`. Index validation precedes range validation; both path and cell indices are
safe nonnegative integers; `cellInto` validates all indices before destination/offset and
writes exactly two slots atomically. No occupancy accessor, mutator, continuation object,
or raw internal array is exposed.

**One root confirmation requested.** This proposal makes `maxCells` a static
potential-output admission ceiling. The only credible alternative is a `maxWork` budget
charged by actual neighbour enumerations, which would create a dynamic budget failure and
stream-state/error-precedence surface. The static ceiling is smaller, prevents a
mid-generation resource error, and matches the decision’s “complete checks before
generation” requirement; root should accept it or select that one alternative before a
catalog entry is drafted.

## Fixture outline after admission

Seven shared vectors are sufficient to distinguish the frozen behavior before native
ownership checks:

1. One available start with `maxSteps:0`: it is emitted/reserved, returns `step-limit`,
   and leaves the random state unchanged.
2. A one-cell boundary grid: start emits once, reports `blocked`, and consumes no unit.
3. Two identical ordered starts: first reserves/emits; second is empty with
   `occupied-start` and no added stream consumption.
4. A small path whose first choice has two or more available N/E/S/W candidates: verify
   neighbour ordering, exact selected coordinate, and final state.
5. A path with exactly one available candidate: it moves and advances the stream once.
6. Multiple starts that encounter cells claimed by earlier paths: verify shared occupancy,
   output order, non-overlap, and exact per-path reasons.
7. Empty starts plus invalid/out-of-bounds start, malformed all-zero state, and a checked
   potential-cell over-budget case: each fails or succeeds before RNG/output allocation as
   specified.

Native checks follow separately: detached construction/export and accessor carriers,
`Into` sentinels/precedence, deterministic seed replay and returned-state continuation,
and no mutation on a rejected configuration. An eventual Java example should prove that
stroke/mark edits reuse the same retained paths; it is not a source-pixel reproduction.

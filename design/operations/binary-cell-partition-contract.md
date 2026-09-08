# Binary integer-cell partition — normative contract 0.1.0

Root approved semantics for implementation after CP17 private native investigation.
Operation `layout.binary-cell-partition-2d`; catalog is the schema authority. This document
specifies behavior, not an additional schema. No implementation or target acceptance follows.

## Artist boundary

Generate an irregular rectangular tiling, retain it, and decorate its cells independently.
Inputs are exactly seed, columns, rows, attempts, axisPolicy. Every field is required;
no defaults or encouraged ranges. columns/rows are positive signed32 cell counts. attempts
is integer0..2147483646; seed is uint32; axisPolicy is exactly RANDOM or LONGEST.
Root starts [0,0,columns,rows]. Bounds are [left,top,right,bottom], in integer cell units,
with right/down positive axes. Adjacent cells share boundaries but not positive area.
Translation and cell-to-world scaling are caller arithmetic, not a coordinate mode.

The extracted components are poop#0 and barab#0 at upstream revision
69bdd8513e4482a5e6018e36887d4bc208660eb5. Notes and exact candidate evidence hashes are
in the catalog. Phase2 ledger accounts for composition and source replay remainders.
Unequal four-child pliegues and griton's biased deletion are not equivalent computations.
See evidence/parameter-experiments/cp17-binary-partition/decision.md for the five-frame
private investigation. Attempt settings20/80/240 and policy examples are observations,
not a recommended range. No bias parameter or guessed minimum panel size is exposed.

## Ordered computation and random consumption

Use xoshiro128**1.1 with SplitMix64 seed expansion and uint32/2^32 unit mapping exactly as
specified by layout.seeded-quadrant-partition-2d0.1.0. A new private stream is created per
call. No host RNG, global state, time, renderer, noise or assets are consulted. Stream is
not returned; identical input recreates identical output. Zero attempts consumes no units.

Begin with one live leaf. For each attempt, in increasing order:

1. Consume one unit u. Select floor(u * liveCount) from the current ordered sequence.
2. RANDOM consumes a second unit; choose width if u<0.5, otherwise height. LONGEST consumes
   no axis unit; choose width only when width>height, otherwise height (including ties).
3. If the chosen extent is one, this attempt fails. Leave all leaves unchanged and consume
   no cut unit. Do not retry, switch axes or stop early when all cells are saturated.
4. Otherwise consume one unit, even at extent two. Cut offset is
   1+floor(u*(extent-1)). This samples every interior integer boundary via the specified
   bounded unit mapping; it is not a rejection-sampled exactly uniform integer mapping.
5. Remove the selected parent, preserving all survivor order. Append the child on the
   lower coordinate side, then the child on the upper coordinate side. Increment splits.

All integer subtraction/addition is exact within signed32. Unit multiplication separately
rounds binary64 nearest ties-to-even before floor; do not change to integer multiply-shift
or host random bounds. Extents<=2147483647 ensure mapped indices remain in bounds. Finite
integers crossing Java interchange normalize negative zero to integer0. Output integers,
leaf order and split count compare exactly, with no epsilon.

This deliberately differs from Processing's float cut mapping, excluded far interior
boundary, same-bound random behavior and barab's discarded axis draw. No compatibility
alias or pixel-identical original recreation is claimed.

## Result, ownership and errors

Portable output is exactly {bounds: ordered list of four-integer bounds, splits: integer}.
There is always at least one leaf; size=splits+1, splits<=attempts. Every leaf has positive
integer area, stays inside the root, does not overlap another leaf's interior; union is the
root. No tree history or persistent cross-run identity API. Output is immutable internally;
all exported values and arrays are fresh. No caller buffer is retained.

Java class org.procedurals.layout.BinaryCellPartition2D offers:
- generate(Object exact configuration Map), and typed
  generate(long seed,int columns,int rows,int attempts,String axisPolicy).
- size(), splits(), boundsAt(long index) returning a fresh int[4],
  boundsInto(long index,int[] destination) requiring exactly length4, and toValues().

Static numeric Map values accept only Byte, Short, Integer, Long, Float and Double;
booleans, arbitrary Number subclasses, strings and null are invalid. Require finite exact
integers in their field domains before narrowing. Strict key set; no defaults, coercion or
unknown keys. Map extraction validates all fields before generation. Typed overload follows
the same domains. No source List/Map is retained or mutated.

PartitionException extends IllegalArgumentException with stable public code:
INVALID_INPUT for invalid creation/configuration; INVALID_INDEX for negative or greater
than9007199254740991 accessor indices; INDEX_OUT_OF_RANGE for otherwise valid indices>=size;
INVALID_OUTPUT for null or non-length4 destination. Validate index before destination;
no destination write until validation completes. No partially created layout is returned.
Allocation failure is a host resource failure, not a fabricated INVALID_INPUT error.

## Performance and acceptance

Representation ceiling attempts+1<=2147483647 permits signed32 indexed parallel coordinate
arrays, not an allocation promise or a useful work bound. Grow with successful leaves,
not requested attempts. Saturation does not authorize skipping RNG consumption. Ordered
array removal permits O(attempts*maximumLiveCount) time and O(finalLiveCount) storage;
boundsInto must allocate nothing. Avoid storing both an object tree and packed copies.
Measure tiny, observed source-scale and unsaturated stress cases before acceptance.

Shared fixtures include zero attempts, unit saturation, both policies, width/height and tie
choices, failed attempts, canonical seeds and high-bit seed, exact ordered vectors, maximal
coordinates, malformed fields and output errors. Native PanelMarks must demonstrate an
attempt-count edit, axis-policy edit, independent palette change, decoration transfer using
retained layout, exact reset and cached save. Validate extracted distribution before shipping.
Java is the first implementation; p5.js, py5 and Android remain deferred with no support claim.

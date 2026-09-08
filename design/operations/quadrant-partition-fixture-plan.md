# CP4 distinguishing fixture plan

Root's semantic checklist for the draft region contract. These are fixture requirements,
not executed operation conformance. The private five-image render is complete and frozen.

Use the established independent xoshiro/Two-SplitMix64 seed oracle rather than the private
JavaRandom walkthrough. Seed vectors should reuse the five CP3 seed cases and verify one
unconditional draw per requested successful replacement. A dynamic split failure returns
no partial result; tests must distinguish it from a silent skipped leaf.

## Geometry and ordering

- Zero replacements returns the validated root with creation ID0 and no RNG draw.
- One split returns IDs1,2,3,4 at TL,TR,BR,BL, all sharing the same computed boundaries.
- Several splits preserve append-child/remove-parent final order. Pick a seed whose next
  chosen parent is neither first nor last, so swapping removal with last is distinguishable.
- At odd live counts (7,13,...), compare fractional selection with the wrong floor(N/2)
  eligible count. Pick a seed whose sampled index actually differs.
- Compare a control case against sorting by size, breadth-first processing,
  recursive depth-first generation and independent child-coordinate calculations.
  Sorting by creation ID is equivalent to the specified final live order, since only
  monotonic appends and removals occur; it is not a distinguishing wrong alternative.
- Creation IDs belong to births within one run, never current result indices. A removed
  parent's ID must not be reused; unchanged leaves retain their IDs and bounds.
- For a longer replacement count, earlier split history is preserved but the final leaf
  array is generally not a prefix. Do not copy CP3's retained-placement-prefix guarantee.

## Root validation versus requested splitting

Root endpoint and represented-span checks are static and apply even to count zero. Schema
and numeric-field validation precede these calculations. Invalid root geometry raises
INVALID_RECTANGLE with no dynamic index sentinel. An unsplittable *positive root* remains
valid at count zero; midpoint checks happen only for requested splits.

Concrete root cases (binary64):

| x origin | x extent | requested replacements | consequence |
| --- | --- | --- | --- |
| 1 | 2^-53 | 0 | endpoint collapses to origin; invalid root |
| 1 | 2^-52 | 0 | valid positive root |
| 1 | 2^-52 | 1 | midpoint rounds to left; dynamic midpoint_x at index0 |
| 1 | 2^-51 | 1 | first split succeeds |
| 1 | 2^-51 | 2 | selected child has no interior x midpoint; dynamic index1 |
| 0 | smallest positive subnormal | 0 | valid positive root |
| 0 | smallest positive subnormal | 1 | underflowed midpoint, dynamic index0 |
| 0 | twice smallest positive subnormal | 2 | first split valid, selected child fails at index1 |
| 1e308 | 1e307 | 1 | specified midpoint finite; naive (left+right)/2 overflows |

Repeat relevant cases on y while x is splittable. When both axes fail, x takes precedence.
No child rectangles or IDs are observable after a failed generation. Signed zero input
coordinates canonicalize to positive zero in returned bounds without changing selection.

A non-overflowing midpoint-order adversary found by root is origin
724561829.0940151 and extent42035933441.00085. The computed right endpoint is
42760495270.094864. The specified left+(right-left)*0.5 yields21742528549.594437;
(left+right)*0.5 yields21742528549.59444. Bind raw binary64 bits in the actual fixture.
This arithmetic example is a fixture design input, not rendered parameter evidence.

## Ownership, native carriers and work

Exercise every missing/extra configuration field, wrong numeric carrier, boolean, nonfinite
value, invalid extent/fraction, seed outside uint32 and replacement count outside its
representational bound. Do not allocate a near-maximum result merely to test validation.
Native cases must cover detached input arrays, fresh boundsAt/toValues results, numeric
index carriers and out-of-range precedence, boundsInto offset/destination failures, and
unchanged output slots on failure. Test all four written coordinates and surrounding slots.

Observe realistic workload sizes (including 0,100,200 and larger counts) with checksums
outside the timed kernel. Measure retained versus transient storage separately. A future
optimization must preserve leaf order, identities, every endpoint bit and errors. The
representation maximum does not establish a memory or speed guarantee on any target.

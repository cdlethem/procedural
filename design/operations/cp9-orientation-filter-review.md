# CP9 orientation enclosure filter review

**Status:** private implementation review only. This is not a contract amendment,
benchmark result, portable-support claim, or approval to alter `Delaunay2D`.

The frozen CP9 contract permits a proved exact-sign fast path, provided that it
returns the same sign as the exact dyadic orientation predicate. The proposed
filter may be used only before that predicate. It may return `positive` or
`negative`; every other outcome must execute the existing exact `BigInteger`
fallback. It does not apply to incircle, work charging, ordering, face mutation,
or any observable result value.

## Candidate scalar algorithm

For finite, normalized binary64 coordinates, define an interval by two binary64
endpoints. Each endpoint calculation below is a separate Java expression stored
in a `double` local; it must not use `Math.fma` or reassociate arithmetic.

1. Compute each coordinate difference with ordinary binary64 subtraction. If a
   result is non-finite, return `unknown`. Otherwise enclose it with
   `[nextDown(d), nextUp(d)]`.
2. For each of the two products in
   `(bx-ax)*(cy-ay) - (by-ay)*(cx-ax)`, multiply all four combinations of its
   operand interval endpoints. If any rounded product is non-finite, return
   `unknown`. Widen every product with `nextDown` and `nextUp`; the minimum
   widened lower endpoint and maximum widened upper endpoint enclose that
   product.
3. Compute the orientation interval as
   `[nextDown(product1Lower - product2Upper),
   nextUp(product1Upper - product2Lower)]`. If either subtraction is non-finite,
   return `unknown`.
4. Return positive only when the final lower bound is strictly greater than
   zero; return negative only when the final upper bound is strictly less than
   zero. Otherwise return `unknown` and call the exact predicate.

Every `nextDown`/`nextUp` operation is applied to the stored result of one
rounded operation, never to a source input or a fused expression. A production
implementation should keep the four product values and extrema in scalar locals;
it need not allocate arrays, boxed numbers, interval records, or predicate
objects on the accepted or fallback decision path.

## Why an accepted sign is safe

Let each exact binary64-coordinate difference be `d*`. If Java's correctly
rounded finite subtraction produces `d`, then the adjacent representable values
`nextDown(d)` and `nextUp(d)` bracket `d*`, including the case where `d*` is
exactly representable. The Cartesian product of two such closed difference
intervals has extrema at its four corners. Widening each rounded corner product
therefore encloses the corresponding exact corner product, and their min/max
enclose every real product in the rectangle. Subtracting the second product
interval with the opposite endpoints and outward rounding similarly encloses
the exact determinant.

Thus `lower > 0` implies the exact determinant is positive and `upper < 0`
implies it is negative. An interval touching zero is intentionally not treated
as a zero determinant: the exact dyadic fallback distinguishes collinearity,
small nonzero signs, and cocircular scheduling inputs without changing the
frozen contract.

This argument is conditional on all intermediate rounded values used to form
an enclosure being finite. The filter must return `unknown` before using an
infinite or NaN endpoint, not try to widen infinity into a usable bound.

## Edge conditions and required fallback

| Condition | Filter result | Reason |
| --- | --- | --- |
| Input NaN or infinity | unreachable after CP9 static validation | Do not rely on the filter as input validation. |
| Finite subtraction rounds to infinity | unknown | The exact difference may exceed binary64 range, so adjacent finite enclosure is unavailable. |
| Any corner product or final interval subtraction is non-finite | unknown | Interval endpoint arithmetic has overflowed; exact dyadics remain authoritative. |
| Rounded subtraction/product is `+0.0` or `-0.0` | normally unknown near zero | `nextDown(±0.0)` and `nextUp(±0.0)` straddle zero by the minimum subnormal, so strict sign tests cannot accept an unjustified sign. |
| Underflowed product | safe only if its widened finite endpoints pass the strict sign test | The widened zero neighborhood contains the real underflowed product; otherwise exact fallback decides. |
| Exact determinant zero, cancellation, or tiny nonzero determinant | unknown whenever interval reaches zero | Exact fallback preserves the contract's no-epsilon semantics. |
| Coordinate/product cancellation or mixed extreme magnitudes | commonly unknown | Lower performance is acceptable; exact topology is not. |

Two finite binary64 inputs can have an exact difference outside binary64 range
(for example `Double.MAX_VALUE - -Double.MAX_VALUE`), so finite input does not
justify a finite difference enclosure. Conversely, a signed-zero result does
not create a sign shortcut: strict comparison rejects both signed zeros.

For CP9's minimum-subnormal witnesses, a direct product can underflow although
the exact orientation is nonzero. Those cases are expected to fall through to
exact arithmetic. The mixed-extreme fixture is also expected to exercise an
overflow fallback. These are correctness cases, not filter failures.

## Java 8 and allocation considerations

`Math.nextDown(double)` and `Math.nextUp(double)` are Java 8 APIs over primitive
values. In a `strictfp` class, explicit local subtraction/multiplication has the
required strict binary64 intermediate semantics for a Java 8 target; the code
must not introduce FMA or algebraic reassociation. The JDK 17 compiler/runtime
may report `strictfp` as redundant for its own execution, but retained
`strictfp` preserves the intended Java 8 bytecode contract.

The filter itself can be written with primitive locals and does not require
heap allocation. That is an implementation property to be checked with the
same allocation measurement used for CP9 construction; it is not a general JVM
guarantee about stack frames, JIT compilation, or surrounding topology data
structures. Exact fallback still allocates `BigInteger` intermediates. The
filter is useful only if ordinary workloads accept enough signs while every
adversarial case remains equal to the exact predicate.

## Required evidence before integration

1. Implement a private scalar diagnostic that reports `positive`, `negative`,
   or `unknown`, beside the existing exact dyadic sign, without changing the
   public core.
2. Differentially test every frozen CP9 fixture orientation encountered by the
   schedule, the minimum-subnormal square, integer cancellation, exact and
   near-cocircular inputs, signed zero, and the mixed-extreme four-site input.
   Any non-unknown result must equal the exact sign.
3. Add generated ordinary, near-collinear, extreme-exponent, and random raw-bit
   triples. Preserve a minimal failing raw-bit witness if the filter ever accepts
   the wrong sign.
4. Measure accepted/fallback counts and allocation/time separately for the
   current 9-site, 128/512-site scatter, 20x20 lattice, duplicate/collinear,
   and 2048-site performance inputs. Re-run all frozen topology/work vectors
   before and after integration.
5. Keep incircle exact unless a separate proof and evidence package is reviewed.
   No filter may change charged-stage ordering, queue order, output arrays, or
   error behavior.

The next implementation decision should compare the measured fallback rate and
allocation reduction against the added proof surface. If ordinary cases still
fall back frequently, retain the simpler exact implementation rather than
loosening the enclosure or adding an epsilon.

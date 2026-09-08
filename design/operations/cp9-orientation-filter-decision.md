# CP9 exact-sign orientation filter: root implementation decision

Root approves integrating the finite scalar filter in OrientationFilterProbe before
the existing exact orientation fallback. This changes implementation cost only.
It does not amend the frozen catalog or fixtures, change work units, relax topology,
alter incircle, or establish performance acceptance before the registered rerun.

## Proof reviewed by root

For a separately rounded finite binary64 basic arithmetic result r, its immediate
floating neighbours enclose the exact real result. This includes underflow to
either signed zero. Java's adjacent-value operations have the specified direction
and signed-zero behaviour in the
[Java 8 Math reference](https://docs.oracle.com/javase/8/docs/api/java/lang/Math.html#nextDown-double-).
The implementation remains strictfp for Java 8 compilation and uses no FMA.

Enclose each of the four rounded coordinate differences independently. Reject the
filter if a difference or either neighbouring bound is nonfinite. Product extrema
over two finite closed intervals occur at the four endpoint combinations. Min/max
of their rounded products, each widened once outward, enclose the exact extrema:
widening the min/max is equivalent to taking min/max after widening each corner,
because adjacent-value stepping is monotone over non-NaN values. Signed zeros have
the same widened lower/upper bounds. Any NaN or infinite product bound rejects
the filter; no accepted certificate depends on unbounded endpoint arithmetic.

Subtract opposite product bounds, widen each result outward, and require both
final bounds finite. The exact orientation determinant lies in this final closed
interval. A strictly positive lower bound or strictly negative upper bound proves
its sign. Every other result means unknown, never collinear: run the existing
exact BigInteger predicate. Thus a true zero cannot be accepted as nonzero, and a
small uncertain determinant cannot silently become zero. The exact fallback is
unchanged and handles extreme finite inputs.

Root also read the independently authored cp9-orientation-filter-review.md. Its
finite-enclosure reasoning agrees. The scalar min/max implementation avoids arrays
and interval records. Accepting fewer cases is permissible; widening less, ignoring
nonfinite bounds, using an epsilon, or treating unknown as zero is not.

## Evidence and integration requirements

The private probe uses a separate common-exponent integer determinant as oracle.
Its reviewed run is .work/cp9-orientation-filter/review1/result.json: random ordinary
and raw-bit finite triples, exact/near-collinear triples, zero/subnormal/extreme
boundaries, and all 1344 ordered distinct-vertex triples from the successful frozen
fixtures. These cover every site triple the fixture schedules can query. Every
certified sign must match the exact oracle; uncertainty is allowed.

The proof establishes the general finite sign condition; sampled checks supplement
it and do not substitute for it. No renderer comparison is involved.

Integrate only this orientation filter before the existing exact implementation.
Preserve all public methods, exact incircle, coordinate values, charged schedule,
queue rules and traversal order. Rerun the unchanged 36 shared vectors and native
ownership/access tests, then the exact registered eight performance workloads in
a new attempt directory. Compare every result checksum and workUsed to cp9-first.
Record allocation/time improvements, including workloads that still fall back.
Private diagnostic certification counts are available; no global counter or new
public instrumentation is to be added merely to report production fallback rates.

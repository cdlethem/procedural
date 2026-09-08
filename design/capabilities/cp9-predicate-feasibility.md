# CP9 exact predicate feasibility

**Status:** bounded engineering investigation, not a capability decision or a triangulation
contract. The question is whether orientation and incircle *signs* can be defined over the
exact rational values represented by finite binary64 coordinates, without an epsilon or a
third-party geometry kernel. It does not choose an algorithm, point-set API, ordering,
resource bound, or artistic parameter.

This follows the gap recorded in [the triangulation evidence audit](triangulation-evidence-audit.md):
the inspected source ports and third-party calls leave duplicate, collinear, cocircular, and
face-order behavior unspecified. The project already uses the same basic exact-dyadic idea
for a four-point drawing convexity check in
[`DrawingValues.strictlyConvex`](../../packages/java/src/main/java/org/procedurals/internal/DrawingValues.java).
That implementation is neither a triangulator nor an incircle predicate.

## Exact represented-coordinate model

For a finite binary64 bit pattern with sign bit `s`, exponent field `E`, and fraction `F`,
write the represented rational as a signed integer mantissa times a power of two:

```text
E = 0:        (-1)^s * F          * 2^-1074
1 <= E <=2046:(-1)^s * (2^52 + F) * 2^(E - 1075)
```

A zero mantissa represents zero regardless of its sign bit. Thus `+0` and `-0` have the
same predicate value. Every nonzero subnormal is covered by the first row, including
`2^-1074`; every finite normal is covered by the second, including the finite maximum.
NaN and either infinity must be rejected before decomposition: they are not represented
rationals for this purpose.

Given a set of coordinates, select the least nonzero exponent `q`, replace each coordinate
with its signed integer mantissa left-shifted by `exponent - q`, and calculate the
determinant with integer operations. This changes only the determinant's positive scale,
not its sign. It avoids every floating subtraction, product, overflow, and underflow in the
predicate.

The two useful algebraic signs are:

```text
orientation(a,b,c) = (bx-ax)(cy-ay) - (by-ay)(cx-ax)

adx = ax-dx; ady = ay-dy; ... cdx,cdy
alift = adx^2 + ady^2; ...
incircle(a,b,c,d) = alift*(bdx*cdy-bdy*cdx)
                 - blift*(adx*cdy-ady*cdx)
                 + clift*(adx*bdy-ady*bdx)
```

The incircle expression is an algebraic sign only. With counterclockwise `a,b,c`, positive
means `d` is inside their circumcircle, negative means outside, and zero means cocircular;
reversing the first triple reverses that interpretation. A future contract would need to
state how it combines orientation and incircle signs, especially for a collinear first
triple. This investigation makes no such choice.

## Representational cost

The nonzero mantissa has at most 53 bits. The lowest possible exponent is `-1074`; the
highest finite-coordinate mantissa exponent is `971`. A common-exponent conversion can
therefore shift by at most 2,045 bits.

| Calculation | Conservative maximum integer magnitude | Consequence |
| --- | --- | --- |
| aligned coordinate | less than `2^2098` | an aligned coordinate needs at most 2,098 bits |
| coordinate difference | less than `2^2099` | includes subtraction of opposite finite extremes |
| orientation product | less than `2^4198` | determinant magnitude has at most 4,199 bits |
| incircle lift / 2×2 minor | less than `2^4199` | squares, sums, and cross minors remain exact |
| incircle three-term determinant | less than `2^8400` | largest temporary payload is about 1,050 bytes before `BigInteger` object and allocation overhead |

These are representational limits for one predicate, not a valid input limit, heap budget,
or runtime bound. Extreme mixed-exponent inputs reach the large shifts; ordinary similarly
scaled canvas coordinates use much smaller integer operands. A production implementation
would still need an explicit point-count/work bound and allocation strategy. Exact signs do
not make an all-triples triangulation acceptable, and this work does not recommend one.

## Private Java measurement

[`ExactPredicateProbe.java`](../../tools/diagnostics/cp9/ExactPredicateProbe.java) independently
implements both routes:

1. common-exponent `BigInteger` determinants; and
2. a dyadic rational oracle that carries a separate integer mantissa and power-of-two
   exponent through subtraction, multiplication, and addition.

It does not import project geometry code, triangulate, or render. It checks equality of the
two sign routes on the following finite binary64 cases and records the ordinary direct-
`double` result only for contrast:

| Case | Exact orientation | Direct orientation | Exact incircle | Direct incircle |
| --- | --- | --- | --- | --- |
| ordinary unit triangle, interior point | positive | positive | positive | positive |
| `(0,0)`, `(134217729,134217728)`, `(134217728,134217727)` | negative | zero | negative | negative |
| minimum-subnormal right triangle | positive | zero | zero | zero |
| `(-MAX,0)`, `(MAX,0)`, `(0,1)` | positive | nonfinite | negative | nonfinite |
| unit-diamond cocircular point | positive | positive | zero | zero |
| equivalent signed-zero input | positive | positive | positive | positive |

The cancellation case is the prior drawing witness. The extreme case demonstrates that a
direct expression can be nonfinite even when the exact predicate has a finite, nonzero
sign. The subnormal case distinguishes a zero computed determinant from exact collinearity.

On the pinned JDK `17.0.20.1`, one exploratory process measured 100,000 ordinary exact
orientations in 43,588,174 ns and 20,000 ordinary exact incircles in 24,274,301 ns. The
probe has no warmup, repetitions, allocation profiler, or target comparison; those values
are feasibility observations, not a benchmark or performance promise. Its result is kept
in ignored `.work/cp9-predicate/result.json`; the source hash for that run is
`4e6f59b5ac21bac151646670120f7b9577db61e73c758c6ab572b25b8384a50f`.

## Dependency and portability boundary

Java can use `java.math.BigInteger`, a Java SE standard-library class. JavaScript would
need `BigInt` plus a raw-binary64 decomposition through `DataView`; Python can use its
built-in arbitrary-precision `int` plus raw IEEE-754 bit unpacking. These are distinct
implementations of the same mathematical sign rule, not evidence that their cost,
allocation behavior, or host-version support is interchangeable. Each future target would
need independent vectors and native measurements.

The determinant formulas are elementary algebra; this investigation copies no source
triangulator. Using any upstream Bowyer–Watson tab or third-party triangulation library
would create a separate provenance and license review. The exact-predicate route adds no
third-party runtime dependency in Java, but it does add `BigInteger` allocation and
bit-manipulation complexity that belongs in a future implementation and performance review.

## Remaining choices

Before this can support a public operation, root would still need to choose and review:

- static finite-input and duplicate-site treatment;
- an explicit insertion/order and cocircular tie policy;
- whether predicates return only a sign or participate in an owned topology result;
- point-count and resource-failure behavior before allocating retained faces;
- native forms and performance evidence for every claimed target.

No visual rendering, point-set triangulation, public API, catalog record, or source-copying
occurred in this investigation.

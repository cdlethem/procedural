# CP5 triangle mapping — binary64 numeric options

This is a bounded numerical investigation for a possible supplied-triangle point
mapper. It makes no public-contract choice, does not establish an implementation,
and does not prescribe a tolerance or a coordinate range. The companion
[`cp5-mapping-numerics.json`](../../evidence/investigations/cp5-mapping-numerics.json)
contains executable inputs, binary64 bits, and the tool/runtime binding. No image was
rendered.

## Arithmetic studied

For unit inputs `u,v` in the closed interval `[0,1]`, the illustrative source-like
weights are computed separately in binary64:

```text
s  = sqrt(u)
w0 = 1 - s
w1 = (1 - v) * s
w2 = v * s
```

The direct form tested is `((w0*a) + (w1*b)) + (w2*c)` for each coordinate. This is
one possible arithmetic order, not an upstream replay requirement.

The other form is `L(a, L(b, c, v), s)`. The investigated `L` returns its endpoint at
`t=0` or `t=1`; otherwise it uses `a + (b-a)*t` unless `a` and `b` have strictly
opposite signs, in which case it uses `a*(1-t) + b*t`. It canonicalizes an exact zero
to `+0`. These branches are illustrative guards, including their exact operation order;
they are not selected semantics.

## Measured adversaries

The direct and nested forms differ on ordinary finite data. With coordinate endpoints
`(1, 3, -2)`, `u=1/16`, and `v=0.7`, direct output is
`0x1.4000000000001p-1` (`3fe4000000000001`) while nested output is
`0x1.4000000000000p-1` (`3fe4000000000000`). A future exact contract would need to
name an order rather than call both expressions equivalent.

Separate weight rounding also breaks affine identity in a direct sum. For all three
coordinates equal to `1`, `u=2^-53`, and `v=.2`, direct output is the predecessor of
one (`3fefffffffffffff`), while the nested form returns exactly one. At the negative
finite maximum, the direct form can return the next representable number toward zero,
strictly outside the degenerate component interval containing only `-MAX`; the report
records the exact inputs and bits. The bounded adversarial grid found 160 such direct
out-of-bound results out of 172,800 coordinate evaluations, no direct nonfinite result,
and no nested out-of-bound or nonfinite result. That grid is evidence, not a proof for
all binary64 inputs.

An unguarded difference lerp has a separate endpoint hazard. At `u=0`, vertices
`(-MAX, MAX, MAX)` should select `-MAX`; `MAX - (-MAX)` overflows, then `0 * Infinity`
produces NaN. The endpoint-aware nested form and direct form retain `-MAX`. The same
failure appears at `u=1,v=0` for the selected second vertex. Canonical zero deliberately
changes the all-`-0` direct output bit (`8000000000000000`) to `+0`; this is a specified
tradeoff if that policy is adopted, rather than endpoint bit identity for negative zero.

## Validity and degeneracy choices still open

Finite vertices can form a non-collinear triangle whose floating determinant is zero.
For `(0,0)`, `(2^-600,0)`, `(0,2^-600)`, the binary64 cross product underflows to
`+0`, but the exact determinant of the supplied binary64 rationals is positive
(`2^-1200`). Conversely, a tiny collinear triple and a repeated vertex have exact zero.
Finite coordinates can also make the ordinary subtraction-based cross product infinite:
`(-MAX,0)`, `(MAX,0)`, `(0,1)` is exactly non-collinear even though `MAX - (-MAX)`
overflows.

Possible policies with different costs and claims are:

1. Accept every finite vertex triple and define mapping continuously even for repeated or
   collinear inputs. This avoids an arbitrary area threshold and does not reject the
   underflowed tiny triangle. Any uniform-*area* description would then have to apply
   only to nondegenerate triples.
2. Classify collinearity with an exact binary64-rational orientation predicate, using
   integer mantissa/exponent arithmetic. This distinguishes exact zero from underflow
   without an epsilon, but costs implementation complexity and still does not create a
   visually meaningful minimum-area rule.
3. Reject based on a floating determinant. The recorded underflow and overflow cases show
   why this cannot by itself be a robust nondegeneracy rule.

The source grain formulas motivate the comparison but do not require their arithmetic
order, stream, or degenerate behavior in a future public operation. The eventual choice
must separately state finite-input validation, endpoint and signed-zero policy, mapping
order, and what any nondegeneracy claim means.

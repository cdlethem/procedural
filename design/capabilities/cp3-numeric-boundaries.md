# CP3 numeric boundaries for ordered circle acceptance

Status: bounded numeric investigation for a possible CP3 contract. It does not freeze
input bounds, error names, proposal semantics, or a public operation. The private
[`SpacingChoice`](../../tools/diagnostics/cp3/SpacingChoice.java) experiment currently
uses separately rounded binary64 `dx*dx + dy*dy < ((r0+r1)*scale)^2`, with equality
accepted. It checks infinities in most intermediates, but it deliberately remains a
private prototype and does not settle negative values or a nonzero-underflow policy.

The portability requirement is stronger than “finite inputs”: the shared contract must
specify overflow, underflow, ordering, and degenerates rather than inheriting Java
behavior. See [portability](../../docs/portability.md#architecture-constraints). The
existing gradient-path contract gives a useful all-or-error pattern: static validation
precedes work; a later arithmetic failure reports its position/stage and discards the
partial retained result. It does not make a partial path observable.

## Directly executed binary64 cases

The following values were evaluated independently with CPython 3.14.4 and Node
v22.22.1/V8 12.4. Both produced the stated classifications. Hexadecimal literals are
binary64 `float.hex()` values, not decimal approximations. For each pair, `d` is the
one-axis centre distance and `L = (r0+r1)*scale`; strict overlap means `d² < L²`.

| case | exact binary64 inputs | separately rounded outcome | implication |
| --- | --- | --- | --- |
| underflow can accept an overlap | `d=0x1p-540`; `r0=r1=0x1p-539`; `scale=1`; hence `L=0x1p-538` and `d<L` | `d²=+0`; `L²=+0`; `+0 < +0` is false, so the candidate is accepted | A positive but tiny overlap becomes a computed tangent. Finite checks alone do not see it. |
| threshold underflows before its square | `r0=r1=1e-200` (`0x1.87e92154ef7acp-665`); `scale=1e-200`; hence positive sum `2e-200` | `L=(r0+r1)*scale` rounds to `+0` before `L²` is evaluated | Guarding only a nonzero `L` whose square becomes zero misses this positive-operands failure. |
| overflow can accept an overlap | `d=0x1p+512`; `r0=r1=0x1.0000000000001p+511`; `scale=1`; hence `L=0x1.0000000000001p+512` and `d<L` | `d²=+∞`; `L²=+∞`; `+∞ < +∞` is false, so the candidate is accepted | Squaring has erased the strict relation. |
| centre subtraction overflows | centres `(+0x1p+1023,0)` and `(-0x1p+1023,0)`, finite positive radii | `dx=+∞` before squaring | The comparison has no finite binary64 meaning; the private prototype already throws at this stage. |
| radius sum overflows | coincident centres, `r0=r1=0x1p+1023`, `scale=1` | `r0+r1=+∞` | Individually finite radii do not make a finite threshold. |
| ordinary exact tangency | centres `(0,0)`, `(2,0)`; radii `1,1`; scale `1` | `d²=L²=4`; strict test false | The proposed equality-accepted rule works at ordinary values. |
| one ULP inside ordinary tangency | replace `d=2` with `0x1.fffffffffffffp+0` | `d²=0x1.ffffffffffffep+1 < 4`; strict test true | This distinguishes the ordinary boundary without an epsilon. |
| negative scale aliases positive scale | `d=1`, radii `1,1`, scale `-1` | threshold is `-2`, but its square is `4`, identical to scale `+1` | A negative clearance silently acts as positive clearance under squaring. |
| zero scale co-locates positive circles | `d=0`, radii `1,1`, scale `0` | `0 < 0` is false | Zero can mean an explicit “disable separation” mode, but it cannot support a non-overlap claim. |
| zero/negative radius makes non-geometry | same centre; radii `1,-1`, scale `1` | sum and limit are zero; strict test false | The candidate is accepted despite a negative radius; two zero radii similarly co-locate. |
| zero-area proposal rectangle | origin `(0,0)`, width/height `0`, positive radius `1`, scale `1` | every generated centre is `(0,0)`; the first is kept and the second is rejected (`0 < 4`) | This has deterministic behavior, but is a point proposal domain, not an ordinary rectangle. A zero-width/nonzero-height domain is likewise a line. |

The two false-accept cases are not rendering issues and do not need an epsilon. They
follow directly from the stated binary64 operations. The current 640px private profile
is far from these exponents; that observation is not an input-range decision.

## Invalid and degenerate geometry choices

A minimal static rule should at least distinguish these cases before proposal generation
or filter acceptance:

| value | policy alternatives | consequence that must be named |
| --- | --- | --- |
| candidate radius | require finite `radius > 0`; or deliberately support point candidates as a separate operation | Accepting zero or negative radii through the circle predicate is not meaningful circle placement. |
| seeded radius interval | require finite `0 < minRadius <= maxRadius` | A reversed interval makes the product formula decrease with its units; it is not merely another small-form distribution. |
| separation scale | require finite `scale > 0`; or permit exactly zero as a documented no-exclusion mode | Negative scales must be rejected. If zero is permitted, coincident positive circles are allowed and output must not be described as non-overlapping. |
| rectangular span | require finite `width > 0` and `height > 0`; or explicitly admit line/point proposal domains | Negative spans reverse sampling order; zero spans are degenerate domains, not ordinary rectangular placement. |
| origins/explicit centres | require finite binary64 values | A finite coordinate pair can still produce an infinite subtraction with another finite pair, so this does not finish arithmetic validation. |

The explicit filter has no rectangular-domain parameter. It should validate its candidates
as circle geometry independently of the seeded convenience; applying the convenience’s
rectangle rule to authored radial proposals would be an accidental coupling.

## Three policy paths for root

### 1. Finite positive geometry plus checked pair arithmetic

Validate all static values and all explicit proposals before producing any result. During
ordered acceptance, compute the current separately rounded expression in named stages:
`dx`, `dy`, `dxSquared`, `dySquared`, `distanceSquared`, `radiusSum`, `limit`, and
`limitSquared`. A nonfinite stage is an error. So is a nonzero `dx` or `dy` whose square
is zero; for positive radii and positive scale, a computed `limit==0` is also an error,
as is a nonzero `limit` whose square is zero.

This preserves the simple familiar predicate on ordinary canvases and rejects both
measured false-accept examples. Its tradeoff is that finite explicit inputs may fail only
when a later candidate is compared with an earlier accepted circle. The result needs a
candidate source index and a stage; if the contract reports the retained-circle index too,
that becomes observable API surface and must be justified. On failure, return no retained
prefix. This follows the established all-or-error dynamic-error approach without
pretending that arbitrary finite geometry is always comparable.

### 2. Add a conservative finite envelope, still detect underflow

A contract could use a representational safety envelope rather than allowing giant
coordinates. For example, the following **derived, not artist-recommended** limits make
the prototype’s overflowing additions and squares finite:

```text
explicit centre coordinates: abs(x), abs(y) <= 2^510
radii:                       0 < r <= 2^509
separation scale:            0 < scale <= 2
seeded origin:               abs(origin axis) <= 2^509
seeded rectangle span:       0 < span axis <= 2^509
```

Then a centre difference is at most `2^511`, so each square is at most `2^1022` and
the two-square sum remains finite. A radius sum is at most `2^510`; multiplying by a
scale at most two gives at most `2^511`, whose square is finite. The limits are enormous
relative to an ordinary canvas, but they are still public representational bounds and do
not establish a useful artistic range.

This does **not** eliminate near-coincident underflow: two independently valid centres
can be arbitrarily close. The contract would still need path 1’s underflow detection, or
would need to state that the binary64 predicate itself, including a rounded zero square,
is the geometry definition. The latter is deterministic but cannot honestly promise
mathematical non-overlap in the first table’s case.

### 3. Specify a normalized robust comparator

A third path rescales differences and threshold before squaring (or uses an explicitly
specified hypot-like comparison), avoiding both extreme squares. It must also prevent
`x0-x1` from overflowing before scaling. A portable version therefore needs a complete
exponent/scaling algorithm, separate rounding order, signed-zero treatment, and new
tangency vectors. It can widen the accepted numeric domain, but it changes decisions near
tangency from the simple prototype and creates substantially more cross-host test surface.
It is not a small implementation detail and should not be substituted silently.

## All-or-error and fixture obligations

Whichever policy root chooses, the smallest conformance set should include these exact
inputs and outcomes, with output absence asserted for every error:

1. ordinary tangent `(0,0,1)` then `(2,0,1)` at scale `1`: both retained; replacing the
   second x with `0x1.fffffffffffffp+0` rejects the second.
2. the underflow pair from the table and the overflow pair from the table: either the
   selected dynamic arithmetic error with candidate index `1`, or a normalized-comparator
   result explicitly frozen by the chosen algorithm. They must never silently inherit the
   prototype’s false acceptance.
3. subtraction and radius-sum overflow pairs, plus the positive-operand
   `r0=r1=scale=1e-200` threshold-underflow pair: no partial first circle escapes when
   the second comparison errors.
4. radius `0`, radius `-1`, scale `-1`, reversed radius interval, width `0`, height `0`,
   and negative width. The fixture must distinguish rejected input from an intentionally
   admitted zero-scale or degenerate-domain mode.
5. a late invalid explicit candidate after one otherwise accepted candidate: validation or
   dynamic failure leaves no result object, no partial array, and no observable mutable
   RNG state.
6. a normal bounded canvas profile and an authored radial proposal sequence, so the
   chosen guard does not accidentally apply the seeded rectangle’s domain constraints to
   the filter.

No tolerance belongs in these fixtures. Every comparison uses either exact integer/error
fields or explicitly stated binary64 values and operation order. Root must select the
geometry domain and failure policy before an operation contract, catalog fixture, or
public promise of non-overlap is written.

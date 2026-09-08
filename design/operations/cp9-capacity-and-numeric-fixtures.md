# CP9 capacity ceiling and numeric fixture feasibility

**Status:** bounded verification for a future point-set result. This is neither a public
contract nor an implementation. It establishes a signed-index representation ceiling and
records small, exact binary64 predicate witnesses. It does not set an artistic count,
default, allocation guarantee, or topology ordering.

## Packed signed-int ceiling

Let `N` be the submitted site count after any future static count validation and `U` the
number of distinct retained sites, so `U <= N`. For a simple planar straight-line
triangulation with `U >= 3` and a noncollinear site set, let `F` be the bounded-face count
and `E` the undirected edge count. Euler's relation and a hull of at least three vertices
give:

```text
F = 2U - h - 2 <= 2U - 5
E = 3U - h - 3 <= 3U - 6
```

For a result with packed arrays of coordinate components (`2U`), triangle indices (`3F`),
edge endpoints (`2E`), and two aligned face references per edge (`2E`), each array length
must fit a nonnegative signed Java `int`. If input-to-unique and unique-to-input mapping
arrays have lengths `N` and `U`, respectively, their lengths must fit too.

Set `I = 2^31 - 1 = 2,147,483,647`. The edge arrays bind first:

```text
2E <= 2(3U - 6) = 6U - 12 <= I
U <= floor((I + 12) / 6) = 357,913,943
```

At `N = U = 357,913,943`, the relevant maximum lengths are:

| Packed data | Bound | Length | Fits signed `int` |
| --- | --- | ---: | --- |
| coordinate components | `2U` | 715,827,886 | yes |
| triangle indices | `3(2U-5)` | 2,147,483,643 | yes |
| edge endpoints | `2(3U-6)` | 2,147,483,646 | yes |
| edge-face pairs | `2(3U-6)` | 2,147,483,646 | yes |
| submitted-site map | `N` | 357,913,943 | yes |
| unique-site map | `U` | 357,913,943 | yes |

At `U = 357,913,944`, the worst-case triangle-index length is 2,147,483,649 and each
edge array length is 2,147,483,652, both beyond `I`. Thus `N <= 357,913,943` is a sound
single ceiling if a future result keeps every listed array and permits `U = N`.

The formula is not an allocation promise. A Java array has practical VM/header limits below
or different from this representation limit, and the aggregate memory of several near-limit
arrays is far beyond an ordinary heap. A production factory must calculate with a wider
integer type, reject arithmetic overflow before allocating, and surface host allocation
failure without converting it to an input error. Performance and retained-memory evidence
would still be required at a bounded stress count.

### Exceptions to the planar bound

The `F`/`E` equations assume a simple noncollinear planar triangulation after duplicate
normalization. They do not choose future semantics for duplicates or degenerate input.

- `U = 0` or `U = 1` has no triangle. `U = 2` also has no nondegenerate triangular face;
  a future result may retain zero or one adjacency edge, but neither case reaches the
  planar bound.
- For `U >= 3` collinear unique sites, a nondegenerate Delaunay face count is zero and an
  ordinary straight-line adjacency chain has at most `U-1` edges. The hull-based equalities
  above do not apply because there is no two-dimensional triangulation, although the stated
  upper bounds remain conservative.
- Repeated submitted sites affect `N` and any mapping arrays even when they do not increase
  `U`. A ceiling on `U` alone would not protect an `N`-length map.
- Multiple edges, directed duplicate edges, supertriangle artifacts, or a retained external
  face are outside these formulas. If a future topology retains any of them, it needs a new
  count proof rather than reuse of this ceiling.

## Exact binary64 site fixtures

The following are candidate shared-fixture material, not a fixture file. Every coordinate
is a finite binary64 value written as hexadecimal floating text and raw bits. Predicate
signs are over the exact represented dyadic rationals, using the formulas in
[CP9 predicate feasibility](../capabilities/cp9-predicate-feasibility.md). Face sets below
are unordered: this investigation intentionally makes no output winding or list-order claim.

### `minimum-subnormal-triangle`

```text
0 = (0x0.0p+0 [0000000000000000], 0x0.0p+0 [0000000000000000])
1 = (0x0.0000000000001p-1022 [0000000000000001], 0x0.0p+0 [0000000000000000])
2 = (0x0.0p+0 [0000000000000000], 0x0.0000000000001p-1022 [0000000000000001])
```

`orientation(0,1,2) = +2^-2148`, so the exact site set is noncollinear and has the
one possible face set `{0,1,2}`. Direct binary64 multiplication underflows to a zero
orientation. With `3 = (minSubnormal,minSubnormal)`, the exact incircle determinant of
`(0,1,2,3)` is zero: the four values are the corners of the smallest representable square.
This separates exact noncollinearity from exact cocircularity without an epsilon.

### `integer-near-collinear`

```text
0 = (0, 0)                                      [0000000000000000, 0000000000000000]
1 = (134217729, 134217728)                      [41a0000002000000, 41a0000000000000]
2 = (134217728, 134217727)                      [41a0000000000000, 419ffffffc000000]
```

`orientation(0,1,2) = -1` exactly, so this three-site set also has the one possible
unordered face `{0,1,2}`. The ordinary binary64 determinant rounds to zero through product
cancellation. This is the existing drawing-topology witness in a site-set form.

### `near-cocircular-inside`

```text
0 = ( 1, 0)                                     [3ff0000000000000, 0000000000000000]
1 = ( 0, 1)                                     [0000000000000000, 3ff0000000000000]
2 = (-1, 0)                                     [bff0000000000000, 0000000000000000]
3 = ( 0, -0x1.ffffffffffffep-1)                [0000000000000000, bfeffffffffffffe]
```

`orientation(0,1,2) = +2`. The exact incircle determinant for `(0,1,2,3)` is
`9007199254740991 * 2^-103`, strictly positive. The four sites are a strictly convex
quadrilateral, and the conventional empty-circumcircle criterion therefore selects diagonal
`{1,3}` rather than `{0,2}`. Its unordered Delaunay face set is `{0,1,3}` and `{1,2,3}`.
This conclusion depends only on the stated exact predicate and does not prescribe face
order or winding.

For the exact-cocircular companion, replace site 3 with `(0,-1)`
`[0000000000000000,bff0000000000000]`. The exact incircle sign is zero. Both diagonals
are then geometrically admissible; a future operation needs an explicit tie rule before a
fixture can assert a unique topology.

### `mixed-finite-extremes`

```text
0 = (-0x1.fffffffffffffp+1023, 0)              [ffefffffffffffff, 0000000000000000]
1 = ( 0x1.fffffffffffffp+1023, 0)              [7fefffffffffffff, 0000000000000000]
2 = (0, 1)                                     [0000000000000000, 3ff0000000000000]
```

Let `M = Double.MAX_VALUE`. `orientation(0,1,2) = +2M`, so this is exactly
noncollinear and has the one possible unordered face `{0,1,2}` even though direct
subtraction produces infinity. With a query site `(0,2)`, the exact incircle determinant
is `-2M^3 - 4M`, strictly negative; the ordinary direct incircle expression is nonfinite.
This is a finite-input witness for predicate arithmetic only, not an assertion that a
future renderer or all later topology arithmetic accepts extreme coordinates.

## Derivation record and limits

The private derivation at `.work/cp9-capacity/derive.py` uses Python `Fraction` directly
from each binary64 value and emits `.work/cp9-capacity/derived.json`. It is an independent
arithmetic check of the displayed signs, raw bits, and capacity substitutions; it neither
imports project triangulation code nor generates a mesh. No production implementation,
catalog entry, renderer invocation, or public parameter was changed.

# CP9 fixture policy

Root owns contract and fixture acceptance. The schedule oracle is a private
reference calculation, not a public implementation or a performance certificate.
The shared fixture checker must assess geometry independently of that schedule.

## Exact outputs

Successful fixtures contain exactly the seven portable result fields. Coordinates
are copied binary64 input values after duplicate collapse and positive-zero
normalization. Every output coordinate therefore compares by binary64 bits,
including subnormals and extremes; there is no trigonometry or allowance to justify
an epsilon. Topology, mappings, work counts and error details compare exactly.

The checker must reconstruct the canonical site/mapping facts from inputs and
check face orientation, minimum-first cyclic rotation, sorted unique faces, edges
and final incidence. For two-dimensional inputs it must check all sites participate,
noncrossing geometry and convex-hull coverage, and independently test empty circles
and the cocircular diagonal preference. Small/collinear sets retain mappings but
have no edges. Independent determinant evaluation must not call the construction
oracle's orientation/incircle implementation. Output geometry validity alone does
not validate the observable work schedule.

Use standard fixture special-number substitutions for nonfinite invalid inputs;
never store NaN/Infinity as nonstandard JSON numbers. Numeric-looking strings are
ordinary invalid input unless explicitly designated by that substitution format.
Integral floating maxWork values are valid, as in the other retained contracts.

## Root hand checks of work accounting

These are deliberately small enough to assess against the schedule without trusting
the construction program. Canonical indices sort by X then Y.

| Sites | Canonicalize | Lower | Upper | Locate | Legalize | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Empty | 0 | 0 | 0 | 0 | 0 | 0 |
| One site | 1 | 0 | 0 | 0 | 0 | 1 |
| Two distinct sites | 2 | 0 | 0 | 0 | 0 | 2 |
| (0,0), (1,0), (0,1) | 3 | 1 | 1 | 0 | 0 | 5 |
| Unit square corners | 4 | 2 | 2 | 0 | 1 | 9 |
| 3 by 3 lattice at x,y in {0,2,4} | 9 | 10 | 10 | 6 | 14 | 49 |

The triangle's canonical positive face is [0,2,1], which catches sorting all three
indices and losing winding. The square's initial fan already has preferred
diagonal [0,3]; one internal-edge examination keeps it.

For the lattice, the corner indices are [0,6,8,2]. Initial faces [0,6,8] and
[0,8,2] create the sequence in that order. Noncorner insertions 1,3,4,5,7 visit
2,1,1,1,1 faces respectively. The centre site 4 splits internal edge [0,8]; the
other four sites split hull edges. Creation order is material: sorting the whole
active face sequence after every insertion would be a different budget schedule.

Legalization extracts these endpoint pairs in order:

```
[0,4], [1,4], [1,5], [1,8], [1,4], [1,5], [3,4],
[3,7], [3,8], [3,4], [3,7], [4,5], [4,7], [4,8]
```

The two strict flips replace [1,8] with [4,5], and [3,8] with [4,7]. Local
reenqueue explains repeated pairs without globally repopulating the queue.
Thus maxWork=49 succeeds and 48 fails in legalize with workUsed=48. Budgets
8,9,19,29,35 fail at canonicalize, hull_lower, hull_upper, locate, legalize
respectively with workUsed 0,9,19,29,35. The first charge is atomic; the others
are single units. Complete static invalidity must still win over any budget.

## Acceptance boundaries

Bind generated vectors to the catalog and generating sources. Root reviews the
adversarial numeric witnesses in cp9-capacity-and-numeric-fixtures.md and the
geometry/schedule implementation before accepting those bindings. Hash freshness
does not itself establish semantic correctness. Mutation tests should demonstrate
that plausible wrong mappings, winding, incidence, coverage and tie choices fail.

Native Java implementation must consume the shared vectors unchanged and separately
test ownership, index domains, Into failure atomicity, resource behavior and
representative/stress workloads. A private exact Python oracle, small geometry
checker or successful fixture generation is not native acceptance. Public drawing
and artist workflow validation remain a later, separate milestone.

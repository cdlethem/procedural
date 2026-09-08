# Sol review: circle-placement contracts

Status: approved for contract freeze and portable implementation. The selected
two-operation boundary, shared immutable result, checked pair predicate, private stream
and proposal mapping are coherent. The findings below did not reopen the CP3 architecture
or add another public operation. Native ownership, allocation-failure and package support
remain implementation-conformance obligations rather than claims made by this review.

Reviewed drafts:

- `sampling.ordered-circle-filter-2d@0.1.0`
- `sampling.seeded-circle-placement-2d@0.1.0`

## Accepted boundary

The explicit filter and seeded convenience remain distinct useful responsibilities. The
parallel `centres`/`radii` filter input avoids forcing callers to create per-circle record
objects, while original proposal indices provide the metadata join needed by the radial,
palette and motif substitutions. The seeded route owns its portable stream and feeds the
same ordered kernel without retaining rejected proposals. Neither operation draws,
retains style payloads, accepts callbacks or exposes RNG state.

The result shape is appropriate. It owns packed accepted centres, radii and source
indices; `size` is the accepted count and `attempts` is the original proposal count.
`toValues` explicitly authorizes detached O(N) materialization, while scalar accessors and
`pointInto` support traversal without exposing internal arrays. Omitting `serialize` and
`toJSON` is justified: accepted geometry cannot reconstruct rejected explicit proposals,
and callers already own the replay input. The common proposal ceiling 1,073,741,823 is a
representational bound derived from `2*N`, not a practical allocation or useful range.

The filter predicate is sufficiently explicit: proposals and retained circles are visited
in order; all eight pair stages are separately rounded and checked; rejection uses strict
`distanceSquared < thresholdSquared`; equality is accepted; a rejected proposal skips
later retained pairs. The positive-threshold and nonzero-square underflow guards close the
false-accept cases from the numeric investigation. Dynamic failure returns no result and
does not expose the compared retained index.

The seeded stream is also specified independently of host RNGs: uint32 seed expansion,
SplitMix64 word packing, xoshiro128** 1.1 transition, unit mapping, unconditional x/y/u/v
consumption and proposal arithmetic order are all explicit. Zero attempts, equal radius
endpoints, failed later proposals and longer-attempt prefix behavior have unambiguous
semantics.

## Required contract fixes

1. The seeded `behavior.input` says the input has seven required keys, but the schema and
   listed validation order have six: `seed`, `attempts`, `origin`, `extent`, `radiusRange`
   and `separationScale`. Correct the prose to six.

2. Tailor the copied error summaries to each operation. The filter's `INVALID_INPUT`
   cannot include a reversed radius interval, and its arithmetic error covers pair
   arithmetic only. The seeded operation has no unequal centre/radius arrays. Its static
   error should name a reversed `radiusRange`; its dynamic error may cover proposal and
   pair arithmetic. Keeping the same error codes is correct, but listing impossible input
   causes makes the public contract misleading.

3. The filter must complete its full static pass before allocating result-sized retained
   storage, as well as before pair work. Otherwise a large input with a late invalid radius
   could produce a host allocation failure before the specified `INVALID_INPUT`. A
   temporary full-input snapshot is not required: concurrent mutation is already outside
   the passive synchronous-call contract. Accepted storage may begin growing only after
   the static pass succeeds.

4. Reduce the seeded public proposal-stage vocabulary to failures reachable from valid
   public input, or document the unreachable checks as internal assertions rather than
   conformance errors. With finite positive extent and a unit in `[0,1)`,
   `extent*unit` is finite. With finite `0 < min <= max`, `max-min`, its two products by
   units, and the final radius are finite under the specified stream mapping. The valid
   dynamic proposal failures are the `px+origin.x` and `py+origin.y` additions, exposed as
   `proposal_x` and `proposal_y`. Keeping `proposal_x_product`, `proposal_y_product`,
   `radius_span`, `radius_first`, `radius_second` and `radius` as public error stages would
   create stable outcomes that no valid fixture can exercise. Immediate defensive checks
   may remain implementation assertions.

5. The seeded entry duplicates shared output metadata and several shared behavior
   paragraphs while declaring the filter authoritative. Extend the catalog drift guard
   beyond `output_schema` to the duplicated `fixture_format`, `output_invariants`,
   `behavior.layout`, `behavior.native_types`, `behavior.numerics` and
   `behavior.native_errors`, or remove duplication where the catalog permits a normative
   reference. Today these values match exactly; the requirement prevents a later edit
   from creating two definitions of the claimed common result.

6. Finish the native accessor spelling. Java `pointInto` uses a required typed offset;
   JavaScript and Python offsets default to zero in the existing grid/path APIs. Existing
   JavaScript returns the supplied destination while Java is `void` and Python returns
   `None`; either preserve and state those native transport conventions or deliberately
   choose one documented convention for the new result. Do not leave ports to infer the
   return independently. State that allocation failure from a fresh `pointAt` pair, like
   failed `toValues` materialization, leaves the retained result usable and unchanged.

## Resolution verified

Root resolved all six contract-text findings before fixture freeze:

- seeded static input now says six required keys;
- each operation's `INVALID_INPUT` and `PLACEMENT_ARITHMETIC_INVALID` descriptions name
  only its own input and dynamic arithmetic;
- explicit filtering completes every static validation before result-sized allocation or
  pair work, without requiring a persistent rejected-input copy;
- seeded public proposal stages are `proposal_x` and `proposal_y`; finite product/radius
  checks are internal assertions;
- the catalog checker requires exact agreement for the shared `output_schema`,
  `fixture_format`, `output_invariants`, layout, native types, numerics and native-error
  transport, with a regression for each field;
- access semantics now preserve the established native conventions: required typed Java
  offset and `void`, optional-zero JavaScript/Python offsets, JavaScript returns its
  destination, and Python returns `None`. Fresh-pair or value-materialization allocation
  failure leaves the retained result usable.

The reduced seeded stage vocabulary is mathematically justified for valid inputs. A
finite positive extent multiplied by a 32-bit unit in `[0,1)` cannot overflow. For radius
mapping, `0 < min <= max`: when `min >= max/2`, Sterbenz's lemma makes `max-min` exact;
otherwise the unit's `2^-32` gap below one is much larger than binary64 rounding error.
The span, its two unit products and `min+second` therefore remain finite. A finite origin
plus the nonnegative centre product can overflow, so the x/y addition stages remain public
dynamic errors. Finite underflow and absorption remain defined proposal rounding.

The shared-output drift regression passes. The generated pure fixtures now distinguish
every reachable arithmetic stage, validation precedence, rejection short circuit and
stream-consumption rule below. Native ownership/access cases remain explicitly registered
for later target-language execution.

## Distinguishing fixture closure

The generated fixtures prove the contract beyond ordinary placement. In addition to the
registered seed vectors and representative profiles, they retain cases that distinguish
these observable branches:

- full explicit-input validation beats pair work: a later invalid proposal must return
  `INVALID_INPUT` even when an earlier valid pair would raise an arithmetic error;
- a proposal rejected by its first retained pair does not evaluate a later retained pair
  that would raise an arithmetic error;
- pair-stage precedence covers x then y difference, x then y square, distance-square
  addition, radius sum, threshold product and threshold square, including separate
  threshold-product-zero and threshold-square-zero cases;
- ordinary tangency, one ULP inside, coincident centres, below-one overlap, order changes,
  signed-zero canonicalization and a first tiny positive circle remain exact;
- seeded x-addition and y-addition overflow report the corresponding reachable proposal
  stage, including failure on candidate zero with no output;
- zero attempts performs no stream/proposal/pair work but still validates every static
  field; equal radius endpoints and rejected candidates still consume four units per
  attempted proposal;
- a small seeded candidate sequence, materialized independently, passed to the explicit
  filter yields the same accepted geometry, source indices and accounting;
- native ownership/access tests mutate every caller and `toValues` container, exercise
  all accessors, verify `pointInto` leaves output untouched for each failure class, and
  leave the result usable after failed fresh-pair/value materialization where a controlled
  host failure can be tested.

Exact binary64 bits, topology, indices, counts, RNG states, error codes, candidate indices
and stages require exact comparison. Rendering and cross-host trigonometry remain outside
these pure fixtures.

Final reviewed bindings:

- ordered contract `47c7c84f7349a82a39bf7209ad4ef78b3b71f8ec667c1dab2a6a206d2fc3d978`;
- seeded contract `d871e7c75e1a4f96153aeac2a0cbb7e199ebf8c739c8fa52c26cc899a4879f21`;
- fixture generator `8be93e7db3a0bfd78d041745df09890d367ef95e3caa506fb4abb50ba8fcee7e`;
- ordered fixture `9794e38180193f92e8d76eb43519218e6c42beab4384c0a8e688f4156e0000c8`
  with 37 cases;
- seeded fixture `44e1545d44e8c800d3e0bfcb9682e5998a48a83945f268adfce043585f2bec79`
  with 31 cases, five mapping vectors and five seeds with ten state transitions each.

The fixture generator reproduces both checked-in JSON files exactly. All five seed-vector
records exactly equal the independently frozen records in
`evidence/investigations/cp3-stream-oracle.json`. The seeded oracle maps and filters one
candidate at a time: candidate 1's `square_x` failure in
`pair-failure-precedes-later-proposal-overflow` therefore precedes candidate 3's potential
`proposal_x` overflow. Materializing all proposals first gives the forbidden opposite
outcome, so this is a real streaming-order discriminator.

The ordered set covers every named pair stage and the consequential stage-precedence
pairs. It includes full static validation before pair work, invalid scale on an empty
input, and rejection before a hazardous later retained pair. The seeded set covers both
public proposal stages, static validation at zero attempts, equal-radius stream
consumption, rejected-candidate stream continuation, exact attempt prefixes, the five seed
boundaries and exact equivalence with independently materialized proposals passed to the
explicit filter.

The mapping vectors directly distinguish the specified arithmetic. The centre vector's
separate multiply then add yields canonical positive zero, while fusion yields binary64
`bc90000000000000`. The radius vector's required span/first/second/add order yields
`3fd19a1895c00000`, while regrouping to `min + span*(u*v)` yields
`3fd19a1895bfffff`. Checker guards require these vector IDs, require every mapping unit to
lie on the uint32/2^32 lattice, and require each stream unit to equal its recorded uint32
output divided by 2^32 exactly.

Operation-specific native metadata now keeps JSON limitations honest. It separately
registers nonfinite and Python huge-integer conversion failures for explicit and seeded
coordinate domains, seed range checking before narrowing, unsupported active numeric
carriers, detached ownership, accessor errors and controlled materialization failures.
Those are required native-suite work; their registration is sufficient for pure fixture
freeze.

I independently ran the catalog checker and its 19 focused catalog tests after these
changes. Both passed. I found no remaining semantic or fixture blocker to changing the
two catalog contracts from draft to reviewed and beginning portable implementations.

## Scope retained

No coordinate envelope, epsilon, normalized comparator, requested accepted count,
containment mode, public session, general RNG object, radial generator or style carrier is
needed. The contracts correctly distinguish centre-domain placement from whole-circle
containment and treat finite proposal-map absorption as defined rounding. Native package
support and the editable four-target starter remain later implementation and reproduction
claims.

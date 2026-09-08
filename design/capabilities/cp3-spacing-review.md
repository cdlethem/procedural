# Sol review: CP3 spacing investigation

Status: independent architecture review of the investigation only. This does not admit a
cluster, freeze a signature, approve ranges, or claim target support.

## Finding

Spacing is a sound next capability. It adds a reusable spatial decision that the grid and
path capabilities do not make: accept differently sized forms in proposal order while
respecting the forms already accepted. A useful result is retained placement geometry,
so palette and motif edits need not run placement again.

The cited reports support that task, but they do not yet support one source-faithful
"circle packer." `caramelo`, `candy`, and `studio` share sequential rejection, while their
candidate domains, size distributions, boundary treatment, and separation factors differ.
The reports also appear to call diameter-valued ellipse sizes radii. The investigation is
right to block contract work on pinned-source inspection.

## Recommended public/private split

Keep the two levels under consideration, with different jobs:

1. An ordered geometry filter accepts an explicit finite sequence of circle candidates
   and returns accepted circles in unchanged proposal order. This is the reusable escape
   hatch for radial, nested, authored, or externally generated proposals. It should expose
   geometry rather than renderer objects, palette, motif, shadows, or arbitrary scene data.
2. A seeded bounded convenience generates ordinary candidates and applies exactly the same
   acceptance rule. This should be the tutorial entry point. It owns seed handling and an
   attempt budget, and returns both placements and accounting such as attempts and accepted
   count. It must never imply that the attempt budget is a promised output count.

The convenience removes enough burden only if an artist can describe the placement region,
size draw, separation, seed, and work budget without constructing proposal arrays or RNG
state. The filter alone would leave most of the demonstrated algorithm in caller code. The
convenience should remain geometry-only; candy bodies, segmented rings, speckles, palettes,
and nested decoration stay in editable composition code.

Do not force both levels to use the same storage path. An eager explicit-candidate filter is
portable and inspectable, while the seeded convenience may feed candidates incrementally to
the same internal acceptance kernel to avoid retaining hundreds of thousands of rejected
proposals. Fixtures should prove their acceptance decisions are identical for the same
ordered candidates. This is composition of one rule, not a second packing algorithm.

The explicit candidate form should not acquire an arbitrary payload field. Circle geometry
and an accepted source index are sufficient substitution points; callers can associate
their own parallel data. A generic payload or callback protocol would add cross-language
carrier complexity without helping this capability.

## Semantics that must remain separate

"Space allowed for each form" currently conflates two controls:

- the domain in which a center may be proposed, and whether the entire circle must remain
  inside it;
- the exclusion distance between accepted forms.

These must be named and demonstrated separately. `caramelo` and `candy` appear to propose
centers across a rectangular canvas and allow edge exits; `studio` uses a size-dependent
radial extent. Nested `caramelo` introduces another circular domain. A first convenience may
choose one clear domain policy as a package design, but it must not present that choice as
shared corpus semantics. The explicit filter can support the other proposal domains without
absorbing them.

Likewise, do not expose a source variable called `radius` until the drawing calls establish
its units. Prefer public radius semantics only after converting any diameter-valued source
variables. Exact non-overlap, tangency, clearance, and deliberate overlap are distinct. A
single unexplained `gapFactor` would repeat the reports' ambiguity. The eventual walkthrough
should say whether equality is accepted and whether the control is an additive edge gap, a
scale on summed radii, or a separately supplied exclusion radius.

The filter name should describe sequential rejection or separation. The current evidence
does not justify `Poisson disk`, maximal packing, blue noise, or order-independent results.

## Randomness and edit behavior

The seeded convenience needs a specified portable stream, proposal draw order, and failure
consumption. It can keep that generator private to the operation for the first slice; artists
need a seed, not exposed state words. A later shared seeded-session design may reuse the same
primitive. Host RNG is not an acceptable hidden dependency.

Generate geometry before style. Colour and motif randomness should not be interleaved with
proposal rejection in the portable example, so recolouring and motif replacement retain the
accepted placement values. This is a deliberate usability design that may diverge from a
source sketch's shared random stream and must be labelled as such. A reproduction-specific
configuration can preserve a source stream later if needed.

Changing the proposal domain, size distribution, separation, or seed is expected to rebuild
placements. Changing palette or motif should reuse them. The example should make those two
classes of edits visible and display the accepted count for the fixed attempt budget.

## Minimum evidence before admission

- Inspect the pinned source for all three packing loops: ellipse mode and units, exact
  comparison/equality, candidate domain, size-dependent boundary, proposal draw order, and
  RNG draws. Bind exact source and note hashes.
- Compare at least one nearby fixed-distance or occupancy-grid candidate to show why the
  chosen operation is size-aware sequential rejection rather than generic point spacing.
- Walk through a complete seeded rectangular example and one explicit-candidate substitution,
  preferably radial or nested. This is what earns the filter's public status; absent that
  second use, it may remain an internal seam for the first release.
- Predeclare fixtures for empty and zero-attempt input, equal/tangent candidates, contained
  versus center-only boundaries, large-before-small order sensitivity, rejection accounting,
  deterministic stream consumption, and equivalence between the convenience and explicit
  filter.
- Measure accepted count, proposals, comparisons, time, retained bytes, and peak temporary
  storage at the example scale and at the cited high attempt count. Any spatial index must
  reproduce the reference ordered predicate exactly; speed does not authorize changed
  placements.

`mosaic02` remains a useful negative boundary: it returns a covering partition through
replacement subdivision, not sparse accepted placements. `persons06` motivates the artist's
spacing question but its fixed five-pixel, grid-snapped animated placement is not evidence
for variable-circle semantics.

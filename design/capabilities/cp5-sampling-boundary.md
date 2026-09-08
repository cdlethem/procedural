# CP5 root boundary decision — retained samples with an explicit mapping route

Status: root architecture decision after the accepted seven-image investigation. Both
ledger admissions and catalog contracts are now reviewed and frozen; see
../operations/triangle-points-contract-review.md. Java implementation is in progress.
This document supersedes treating the one-point uniform helper as the entire artist capability.

## Two responsibilities worth specifying

1. A **seeded uniform triangle point batch**: provide a triangle, explicit seed and count;
   retain indexed sample positions for drawing, recolouring or changing marks. Own the
   repeatable stream and batch traversal, so the caller does not implement sampling or
   manipulate random-state words. Uniformity is its explicit distribution claim.
2. A **triangle coordinate mapping batch**: provide the same triangle and explicit pairs
   of unit coordinates; map them with the square-root barycentric construction to retained
   points. No random stream or uniformity claim is implicit. Uniform independent pairs
   produce uniform area sampling; modified pairs permit deliberate concentration.

Specify these as distinct operations sharing one internal mapping/result kernel. Avoid
exposing an additional single-point alias by default. The exact Java naming, parameter
objects, pair carrier and result accessors are contract decisions, not frozen here.

The second responsibility is justified by a concrete substitution: active puntis feeds
(U×V,W), while puntis3 feeds a fresh uniform first coordinate and a biased product second
coordinate. The library need not know those source names or their incidental brightness
work to map either. An artist can change a short coordinate-generation block and keep the
same triangle mapping, storage and drawing code. Public seeded uniform convenience remains
available for the ordinary case; explicit mapping should not become mandatory boilerplate.

## Why this boundary

The private experiment shows that a uniform-only public operation cannot by itself express
the demonstrated concentration. Conversely, a generic callback-driven sampling engine
would import callback/state/error semantics before the package needs them. A fixed list of
source-named sampling presets would turn incidental expressions into permanent public API.
Explicit value pairs offer a small inspectable extension route that ports can specify
without host callbacks. The seeded batch removes routine work from the common entry path.

This is a design choice based on the observed substitution, not a claim that the source
already separates its randomness, mapping, storage and styling. The source shares streams
with colours and overlays. The public uniform stream will be independently specified;
source brightness draws and Processing replay remain outside its claim.

## What stays in the editable example

Triangle construction, determinant area calculation and explicit ceil(area×density) count
allocation remain small example responsibilities initially. No mesh-wide density operation
is admitted without additional evidence of caller burden. The batch operations take
explicit count or explicit coordinate pairs, so they do not couple resolution, area, alpha
and density behind one unexplained control.

Show a legible uniform baseline, the source-motivated coordinate substitutions, independent
mark/palette edits, and CP4 rectangles split into two triangles each. If the mapping route's
materialized input pairs create undue memory or setup burden at the demonstrated counts,
resolve that at contract design before publishing it; do not silently add an iterator or
callback variant. The seven-image prototype used packed output and no per-point objects;
that informs implementation, not a promise about yet-unwritten public carriers.

Delaunay site generation and topology remain separate research. Arbitrary polygon filling,
clipping entire marks to boundaries, font rendering and texture compositing are not implied.
Point-centre containment and whole-mark containment must remain distinct in documentation.

## Contract questions that must be resolved next

- Triangle validity: finite coordinates, zero/near-zero area, winding and numeric overflow.
- Unit-pair domain and exact square-root/weighted-sum evaluation, including endpoint zeros,
  vertex identity, degenerate input, representability and overflow handling.
- Seeded stream and exact consumption; count-extension prefix, count validation and resource
  failure, including whether zero count still validates triangle input.
- Immutable owned results and allocation-free indexed traversal; input detachment, error
  precedence and atomic destination writes across target-specific native carriers.
- Cost of materialized unit pairs versus retained points at the tested workload; do not
  expand to a streaming API solely on hypothetical scale.
- Distinguishing fixtures: naive barycentric bias, swapped input pairs/vertices, RNG drift,
  all boundary cases, exact explicit-to-seeded mapping equivalence, meaningful distribution
  checks and actual Processing edit/transfer behavior.

Both responsibilities require explicit ledger admission/revision and reviewed language-neutral
contracts. The existing `sampling.point-in-triangle` and `mark.stipple-triangle` entries are
historical provisional inputs, not automatic approval for two new public signatures.

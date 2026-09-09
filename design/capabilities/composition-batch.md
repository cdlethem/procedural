# Composition batch: root implementation brief

Status: architectural decisions for the next batch; operation admissions, catalog contracts
and implementation acceptance remain pending. This is not a parallel schema authority.
Maintainer requirement: partition a composition and supply arbitrary content per region,
including snippets of larger drawings, images, generated marks and soft transitions.

## Deliverables and ownership

Root owns the shared pixel/region semantics, admissions and native review. A bounded evidence
worker identifies image-input examples; implementation workers receive catalog contracts only
after root freezes them. Ports and Sol review remain paused. Finish one integrated composition
example before expanding into additional filters. Reuse existing native runners and gallery.

The deliverable is a Java workflow with editable partition layout and replaceable content:
one larger drawing viewed through partitions; different local drawings per partition; a
source-image crop; and a soft transition between two contents. The same placement/masking
machinery must serve all four. A path-only clipping utility cannot satisfy this batch.

## Concrete boundaries

- Keep existing partition outputs as inputs. RetainedRectangles2D already supplies stable
  leaf IDs and bounds. Convert its leaves at the adapter boundary; do not add another
  partition generator merely to demonstrate callbacks. Polygon regions may follow the same
  visibility boundary, but require independently validated rasterization.
- Content callback is a Processing adapter facility, not a portable operation. Its inputs
  include the region ID/bounds and an isolated drawing target. Invoke exactly once per region
  in supplied order during explicit rendering, never for measurement or implicit retries.
  Callback randomness and animation remain explicit caller inputs; the adapter consumes no
  hidden RNG and does not advance models. Retained image content bypasses callbacks entirely.
- A callback draws into an owned transparent scratch target. Never expose the parent canvas
  or rely only on pushStyle/pushMatrix to isolate arbitrary callback changes. Composite after
  successful callback completion. Failure leaves that region unpainted and releases scratch
  resources; earlier successfully painted regions remain, unless a separate whole-composition
  transaction is deliberately requested later. Borrowed targets cannot be retained by callers.

  Private-study refinement: the implemented helper returns an owned pixel buffer and never
  paints into the caller's destination. Adopt this simpler whole-call failure boundary for
  the first public facility: callback failure returns no result and leaves input pixels
  unchanged, including regions processed earlier. This supersedes the incremental-paint
  behavior above. It cannot roll back arbitrary external side effects performed by artist
  callback code; callbacks must manage their own retained state explicitly.
- Global-window mode preserves canvas coordinates. Local mode explicitly maps a local frame
  into region bounds. Fitting an image selects contain or cover deliberately; there is no
  implicit stretching. Source selection and destination placement are separate inputs.
- Portable raster computations use the established straight packed ARGB8 input/output shape.
  Host image decoding, PImage conversion and actual drawing targets belong to the adapter.

## Mixing semantics to freeze in the catalog

Admit masked source-over first as a computation distinct from a two-input crossfade. For
normalized source alpha As, destination alpha Ad and mask m in [0,1], effective source
alpha is a=As*m. Output alpha is a+Ad*(1-a). In premultiplied working channels, output is
Cs*a + Cd*Ad*(1-a); divide by output alpha to return straight channels, with transparent
black when output alpha is zero. Inputs remain immutable and output independently owned.
Mask zero must preserve the destination packed value exactly, including hidden RGB.

For a two-input crossfade, weights are 1-m and m: alpha and premultiplied working channels
use those same weights. This avoids treating two partly transparent inputs as opaque colors.
Endpoint masks preserve the selected input exactly. It is not implemented by two sequential
masked source-over calls: that changes coverage and introduces the wrong destination term.

Use stored encoded RGB channels for this first explicit behavior, with no implicit gamma
conversion. Premultiplication describes alpha handling, not a claim of linear-light mixing.
Final byte quantization, arithmetic order and validation must be fixed in the catalog before
code. No generic blend-mode enum or artistic opacity default is required for these operations.

Existing RasterRemap2D interpolates straight channels independently, including hidden RGB.
Do not silently modify it or claim it supplies transparency-safe filtered placement. Integer
crop extraction can preserve exact pixels; fractional placement of transparent content needs
an explicitly admitted premultiplied sampling behavior or a clearly scoped native adapter.

## Masks and edge coverage

A mask is a bounded scalar field sampled in a declared coordinate frame. Its finite sample
values are [0,1]; zero means no contribution. A crop or region must declare outside behavior
as zero rather than reusing RasterRemap2D's clamped edge-extension rule. Hard rectangle
membership uses half-open edges so adjacent partitions have one owner per sample. Feather
width is a distance in that frame, not an arbitrary percentage of the canvas.

The current private Java2D ellipse study fails the stricter analytic pixel-center criterion
by one boundary pixel in two cases. Do not retrofit the criterion to pass. Native shape
rasterization and analytic sample masks are different capabilities; choose and test the
public behavior explicitly. Soft neighboring weights and layered overlap are also distinct.

## Focused acceptance and stopping point

Use hand-computable pixel fixtures: mask endpoints, a half-mask over an opaque destination,
transparent colored inputs, two translucent inputs, immutable sources and invalid masks.
Include a case distinguishing crossfade from source-over. Native validation exercises a
real Processing callback, state isolation after a deliberate callback error, one shared
drawing through adjacent partitions, independent content, an image crop and a soft transition.
Review rendered outputs centrally. Include one non-flow generated content source.

The stopping point is an accepted and packaged compositional workflow with contracts and
representative native evidence, not this brief or a larger operation count. Further image
analysis, semantic eye extraction, filter inventories and GPU acceleration remain separate
work; none is implied by crop selection or color sampling.

## Native visual review outcome

Root reviewed all four images in .work/partition-content-visual1, with source/output hashes
checked against its manifest. See evidence/parameter-experiments/spatial-composition/
partition-visual-review.json. The generated source, global rings and local crop-plus-mark
panels establish useful content substitution. Feathering creates background-visible gutters
between neighboring panels. Retain it for cutouts, but do not call that seamless blending
between effects. Two-input crossfade remains a required next computation for this batch.
The gallery now includes these four private outputs; that is not public adapter acceptance.

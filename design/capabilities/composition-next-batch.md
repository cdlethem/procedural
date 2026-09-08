# Composition after CP23: bounded next batch

Root decision after the Java0.26 checkpoint. Baseline main commit
a9aed4b98784326fe5cf1911b50b15a4828037e9;26 operations/27 workflows. This is a next-batch
design brief, not operation admission or implementation acceptance.

## Priority

1. Nonrectangular visibility: use a supplied polygon/triangle region with the same content
   substitution as rectangular panels. Establish one canonical scalar-mask boundary rather
   than teaching each content generator about every shape. Existing Delaunay and region
   geometry are consumers/inputs, not evidence that triangle rasterization is already shipped.
2. Image placement: explicit crop selection and contain/cover fitting into a destination
   frame. Separate source selection from destination placement and clipping. A placed image
   should also be usable as the input of a later raster operation, without drawing to the
   parent canvas first. Decide transparent-edge sampling before accepting fractional scaling.
3. Image-derived marks: pursue after bounded source evidence identifies a concrete mapping
   worth encapsulating. Do not add guessed brightness-to-size/density defaults merely because
   an image can be sampled. Existing packed remapping may already supply the sampling needed
   for a first workflow; any new operation must remove an independently useful algorithm.

## Evidence and limitations

Root read eyes002 and terrainCollage for actual image inputs and placement in CP23. The
current bounded follow-up read/search of natan,mosaic002,berlin001,puntis3,puntis4,manchis,
tractrac and desert did not establish a generic image-brightness mark mapping. These reads
are not a full-corpus absence claim. circuloss describes brightness-threshold selection
against a generated mask, but the final mask overlay hides the scatter and its experiments
are pending: it is mechanism evidence, not validated useful output/parameter guidance.

RasterRemap2D explicitly interpolates stored straight channels and clamps at source edges.
That remains accepted behavior. New transparent snippet placement must not silently replace
it or confuse transparent outside-crop coverage with edge extension. CP23 compositors use
premultiplied working color, but they do not resample spatially.

## Next concrete investigation and stopping condition

Private native experiment now implemented in tools/diagnostics/spatial-composition/
MaskContentStudy.java. It rasterizes a callback to native alpha coverage, then feeds those
scalar values into accepted MaskedComposite2D. Actual leased JAVA2D execution passed:
ellipse interior/exterior, half-alpha triangle and source-over pixel expectations. The ellipse
has56 fractional-coverage edge pixels on pinned Processing4.5.6; this is native raster alpha,
not the earlier strict mathematical pixel-center clipping claim. No public support admitted.

Architectural consequence: keep the scalar mask consumer independent from its producer.
A Processing mask callback can provide shaped/textured visibility before a portable polygon
distance/rasterization operation exists. Explicit alpha extraction ignores RGB: opaque black
reveals exactly like opaque white. A black/white luminance mask is a different input mapping
and must be named separately; never infer which interpretation the artist intended. The
private probe establishes shapes only, not font metrics, image decoding or public lifecycle
acceptance. Public preflight and failure cleanup remain to specify before promoting it.

Root specifies mask value/coordinate/edge rules first. Use one triangle plus an irregular
simple polygon, alongside the current rectangle, to test one content callback with hard
visibility and a supplied soft scalar mask. Distinguish analytic pixel-center membership
from native shape coverage; preserve the failed ellipse-edge study as evidence of that
difference. Decide self-intersections, holes and feather distance explicitly before a public
polygon contract. Do not expose every variant preemptively.

Use small analytic masks for boundary/error cases, then one artist-scale image-plus-marks
composition through established native tools. Reuse the shared render lease and current
gallery. Root owns admission/contract/review; delegate implementation only after semantics
freeze. Stop at one integrated accepted capability; no broad corpus audit or filter inventory.

## Partition/content composition — maintainer clarification

Treat layout, content production, placement and visibility as independent choices. A layout
produces regions; content can be a retained drawing/image shared across regions or a callback
evaluated per region. CANVAS coordinates reveal windows onto one larger drawing; LOCAL
coordinates support separate compositions. Local origin does not imply automatic fitting.
Source cropping, destination fitting and final visibility must remain distinguishable.

Prefer this shared composition boundary over adding callback variants to every operation.
Expose a specialized region-aware generator only where the boundary changes the generated
geometry (for example, packing inside a region or a path responding to its boundary).
Masking a completed drawing only changes visibility and cannot claim those behaviors.
Native drawing callbacks must use their supplied target rather than the parent canvas.
Retained content permits reuse without repeating expensive generation or consuming RNG again.

Soft visibility over a background and a transition between two contents are separate artist
choices: composite versus crossfade. Independent feathered panels do not automatically form
a complementary blend. The current two-input crossfade supplies that explicit transition;
general multi-region normalized blending is not yet specified or accepted.

This is a project architecture decision prompted by the maintainer's composition request,
not a claim that the survey establishes a universal higher-order effect API. Acceptance must
demonstrate layout/content substitution and both coordinate modes with generated and image
content. CP23 establishes rectangular callbacks; the candidate MaskMarks batch extends
visibility through drawn alpha masks, with distribution acceptance still pending.

## Port handoff

The pushed baseline includes accepted raster.masked-source-over-2d and raster.crossfade-2d
contracts/fixtures. Ports can implement those pure operations independently on a branch
pinned to the SHA above. Java2DRegions is a Processing adapter with rectangular/density-one
scope; its callback implementation is not portable core. Port acceptance remains root-owned,
with representative native results and the same shared machine render lock. Port integration
and Sol review remain paused while Java capability work continues.

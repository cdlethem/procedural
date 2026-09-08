# Java2D retained layers and alpha masks — implementation contract

Root freezes this adapter boundary after MaskContentStudy. Public implementation/native
acceptance remain pending. This is host transport/lifecycle over the accepted raster
contracts, not a new portable computation or an increase in operation count.

## Artist capability

Draw arbitrary content once to a transparent retained image, draw another image describing
visibility, then composite the content through that mask. The same mask values also drive
RasterCrossfade2D. This enables nonrectangular shapes through native drawing without making
each generator aware of shape types. Images and generated marks are interchangeable inputs.

Evidence: eyes002 notes explicitly propose image/draw-callback content; circuloss constructs
a PGraphics mask and queries it, although its final overlay occludes the scatter. The new
alpha interpretation is project design, not circuloss brightness semantics. Private native
ellipse/triangle tests establish actual alpha transport on pinned JAVA2D. No recommended
opacity, feather width or shape count is inferred from those notes.

## Surface

Final class org.procedurals.processing.Java2DLayers with static methods:

- Content functional interface: `void draw(PGraphics target)`.
- `PImage render(PApplet parent, int width, int height, Content content)` creates a completed
  independently owned ARGB image. One callback receives a borrowed active transparent
  PGraphicsJava2D, density1, identity transform/full clip, RGB255, BLEND, no tint.
- `double[] alphaMask(PImage image)` synchronizes completed density-one input pixels and
  returns detached row-major doubles `(pixel >>> 24)/255.0`. RGB is ignored. This is host
  ARGB-to-mask transport; no threshold, luminance conversion or inferred interpretation.
- `PImage composite(PApplet parent, PImage source, PImage destination, double[] mask)` wraps
  MaskedComposite2D.compose using explicit matching image dimensions and returns detached
  PImage pixels. No new arithmetic. Core validates finite[0,1] mask and exact sample count.
- `PImage crossfade(PApplet parent, PImage first, PImage second, double[] weights)` similarly
  wraps RasterCrossfade2D.mix. Endpoint/alpha semantics come from its catalog contract.

Call on the sketch thread; input PImages are completed, passive and stable during a call.
All PImage inputs require positive dimensions, pixelWidth==width, pixelHeight==height,
pixelDensity1, product<=signed32 indexing capacity and exact available pixel count after
loadPixels. Null parent/content/image and invalid dimensions fail with IllegalArgumentException.
Parent is needed only for image creation/rendering; alphaMask has no parent parameter.
No arbitrary maximum resolution/default size; resource failures propagate without fallback.

Root format clarification before acceptance: support native RGB and ARGB PImage formats.
RGB input is opaque regardless of stored high byte; normalize to ARGB with alpha255 in a
detached transport buffer, and alphaMask returns1 for every RGB pixel. ARGB preserves stored
bits and uses stored alpha. Reject ALPHA-only or unknown PImage formats explicitly with
IllegalArgumentException; do not guess their packed representation. This normalization is
host transport and must not modify the input or change either portable core operation.
Add native RGB-with-zero-high-byte versus ARGB-with-zero-high-byte distinguishing checks.

## Ownership and failures

Input pixel values never change. loadPixels may synchronize the host read buffer. Returned
images/arrays retain no caller arrays. Render validates static input before callback, invokes
once, never retries/consumes RNG/advances models, and returns no partial result on failure.
The caller must not retain/dispose the borrowed PGraphics or call beginDraw/endDraw on it.
External callback side effects cannot be undone. Release all owned scratch resources,
preserve the primary callback RuntimeException/Error identity, suppress cleanup failures.
Keep region rendering unchanged in this batch to avoid unneeded behavioral churn.

Alpha mask zero means invisible and one fully visible. Opaque black and opaque white both
produce1. A native antialiased edge may yield intermediate values. This is not strict
analytic pixel-center polygon membership, signed-distance feathering, or a luminance mask.
Supply an explicit alpha-bearing image to obtain image-shaped visibility; automatic object
recognition/cropping is outside. Shape/path/font drawing retains native Processing behavior;
no portable font or polygon-raster claim follows from the callback facility.

## Acceptance

Use existing shared native lease and pinned Processing runtime. One focused native probe:
ellipse and half-alpha triangle mask interiors/outside/edge fractions; black-vs-white alpha
equivalence; explicit PImage alpha values0/128/255; transfer same mask between composite and
crossfade; independent input/output storage; callback once/exception identity/recovery;
invalid input before callback; dimension/density/mask errors. Verify exact analytic ARGB
outputs where full coverage is known. Native edge rasterization is scoped to this runtime.

One artist-scale workflow must render shape mask and content separately, replace content
without changing mask, and use the same mask as crossfade weights. Show input masks and
outputs in central gallery. Native adapter scope and packaging acceptance are root-owned.
O(pixels) conversion/compositing with no per-pixel objects; one bounded720x480 measurement
includes image transport. No new runner framework, broad render matrix or full corpus audit.

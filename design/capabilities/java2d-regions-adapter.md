# Java2D region-content adapter — implementation contract

Root freezes this Processing-only adapter boundary from the private partition study.
Implementation and native acceptance are pending. This is not a portable operation schema;
portable pixel composition is owned by catalog/operations/masked-source-over.json.
Follow the capability-and-adapter-boundaries and generative-performance skills.

## Artist-facing surface

Class org.procedurals.processing.Java2DRegions, final, static utilities, no retained global
state. Its name deliberately declares the renderer capability. No P2D/P3D fallback.

- Immutable nested Region: public final long id and double left,top,right,bottom;
  constructor validates finite coordinates, positive finite extents and nonnegative safe
  integer ID (<=9007199254740991). Coordinate units are destination logical pixels.
- `regions(List<RetainedRectangles2D.Leaf>)` converts an existing partition snapshot to an
  independently owned List<Region>, preserving IDs/order. This is a convenience, not another
  partition operation. Artists may instead supply their own regions directly.
- Enum Space with CANVAS and LOCAL. CANVAS keeps destination coordinates; LOCAL translates
  origin to region left/top. No implicit scaling or fitting. Reject translation values
  outside finite float representation before invoking any callback.
- Functional interface Content: `void draw(PGraphics target, Region region)`.
- `static PImage render(PApplet parent, PImage destination, List<Region> regions,
  Space space, double feather, Content content)` returns independently owned ARGB pixels.
  Destination establishes dimensions and existing background; no implicit parent capture.

This first adapter supports rectangular visibility regions. Polygon/ellipse regions and
image-fit conveniences remain planned, not implied. Artist callbacks may draw images,
text, geometry and retained package output using ordinary PGraphics calls. Image selection
and crop data remain explicit; the accepted native example must include image content.

## Execution and isolation

Call synchronously on the Processing sketch thread. The destination is a completed,
density-one PImage (pixelWidth==width, pixelHeight==height), with positive dimensions and
product <= signed32 indexing capacity. Reject nulls, invalid dimensions/density, invalid
feather (nonfinite or negative), null region entries and duplicate IDs before callbacks.
Snapshot region order. Off-canvas regions are allowed and still invoke once; empty list
returns a detached destination image. `loadPixels` synchronizes the destination's read
buffer; its pixel values are never changed. Concurrent mutation is outside the contract.

RGB transport correction after CP23: accept RGB/ARGB destination formats; RGB means opaque
even if stored high bytes are zero. Force alpha255 in the detached destination buffer only.
ARGB retains stored bits. Reject ALPHA-only/unknown formats before callbacks. An empty-region
result preserves native appearance; its canonical ARGB bytes may differ from raw RGB input.

Create an owned transparent PGraphicsJava2D scratch surface for each region, with destination
dimensions, density1, RGB255, default source-over, no tint, identity matrix/full clip.
In LOCAL space translate to the region origin, then invoke Content exactly once. Do not
advance RNG/simulation or retry failed content. The callback borrows the active target:
it must not call beginDraw/endDraw/dispose, retain it, or access the parent canvas through
the adapter. It may change its own target's drawing state. External callback side effects
cannot be rolled back and are the caller's responsibility.

After successful drawing/endDraw/loadPixels, use MaskedComposite2D with row-major coverage
at destination centers (x+0.5,y+0.5). Rectangle membership is half-open. Outside is0; inside
is1 for feather0, otherwise min(1,min(distance to each of four edges)/feather). Feather is
an inward linear coverage ramp in destination pixels, not a two-input crossfade or a
corpus-derived visual recommendation. Overlapping regions combine in supplied order.

Return one detached PImage only after every region succeeds. Failure exposes no partial
result and leaves destination values unchanged. Always release owned scratch graphics and
images, attempt all cleanup steps, preserve the primary callback exception and attach
cleanup errors as suppressed exceptions. Input validation throws IllegalArgumentException;
callback RuntimeException/Error propagates unchanged. Native allocation/render failures
propagate; never silently switch renderer or present partially painted output as success.

## Implementation and acceptance

Reuse the private study's reviewed kernel boundary and cleanup logic; do not copy upstream
sketch code. Cite eyes002 image/draw-callback evidence and the maintainer's partition request
in documentation. No defaults or recommended feather width. No public shared-support claim
until root accepts the adapter and native workflow.

The initial implementation uses O(regions*pixels) work with O(pixels) live scratch/mask/output
buffers plus detached result copies, not one retained surface per region. No per-pixel
objects. Measure a four-region720x480 native composition; do not advertise animation or
large partition-count performance based on core-only timings. Optimization can follow only
if it preserves coordinate, pixel-center, overlap, callback and failure semantics.

Native checks: hard outside-region pixels, local/canvas origins, once-per-region order,
image snippet transfer, exact quarter-mask blend, empty regions, duplicate IDs and invalid
input before callbacks, destination immutability, deliberately throwing callback and clean
subsequent render. Root inspects artist-scale global/local/feather images. Use the shared
machine render lease and existing infrastructure. No new renderer matrix is required.

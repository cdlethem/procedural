# JAVA2D image placement — frozen implementation brief

Root boundary decision: image-placement-brief.md. Host-specific convenience, not a new
portable operation. Native acceptance and distribution are pending. Uses accepted
Java2DLayers.render and completed-image transport; native scaling/rasterization is scoped
to pinned Processing4.5.6 JAVA2D, density1. Sol/ports remain paused.

## Public surface

Final class org.procedurals.processing.Java2DImagePlacement:

- immutable Crop(int x,int y,int width,int height), public final fields. x/y nonnegative,
  width/height positive. Bounds against the actual image are checked by render.
- immutable Frame(int x,int y,int width,int height), public final fields. Signed origins,
  positive extents. Canvas clipping permits a partly or wholly off-canvas frame.
- enum Fit { CONTAIN, COVER, STRETCH }.
- static PImage render(PApplet parent,PImage source,Crop crop,int canvasWidth,
  int canvasHeight,Frame frame,Fit fit,double alignX,double alignY).

All arguments explicit; no inferred crop, fit, alignment or default size. Alignment finite
in[0,1]. Zero aligns left/top, one right/bottom. Source crop and destination frame are
half-open rectangles in pixel-edge units. Integer selection avoids ambiguity about which
source pixels a snippet contains; fractional fitted position/size remains native behavior.

## Preflight, mapping and ownership

Reject null values, invalid dimensions, crop outside image, non-RGB/ARGB format, density
other than1, mismatched pixelWidth/Height, or non-exact pixel-array length after loadPixels
with IllegalArgumentException. Check canvas/source products using long and require positive
product<=Integer.MAX_VALUE. Check crop endpoints with long to avoid integer overflow.
Preflight all static inputs before allocating render targets. Constructors validate their
own dimensions/origins; render validates cross-object relationships.

Synchronize completed source via loadPixels, then copy crop rows into a new ARGB PImage.
RGB source pixels force alpha255 in the copy; ARGB preserves stored bits. Never mutate
source pixels or share its arrays. Crop copy prevents filtering from reading excluded
neighbors. Synchronous sketch-thread use only, matching Java2DLayers image lifecycle.

For STRETCH, fitted width/height equal frame width/height. Otherwise compute in binary64:
sx=(double)frame.width/crop.width, sy=(double)frame.height/crop.height;
s=min(sx,sy) for CONTAIN or max(sx,sy) for COVER;
w=crop.width*s; h=crop.height*s.
For all fits: x=frame.x+(frame.width-w)*alignX;
y=frame.y+(frame.height-h)*alignY. Convert x,y,w,h to float for native drawing.
These arithmetic rules document this adapter; they are not a portable raster guarantee.

Return Java2DLayers.render(parent,canvasWidth,canvasHeight, callback). On the borrowed target,
set imageMode(CORNER), set the frame clip with native clip(x,y,width,height), and draw the
isolated crop at fitted x,y,w,h. Native clip plus output canvas bounds constrains COVER;
CONTAIN margins stay transparent. All drawing targets and cleanup remain owned by the
existing layer helper. Do not modify parent drawing state, draw into a destination image,
add compositing arithmetic, use PImage.resize, or change RasterRemap2D semantics.

Native image interpolation is the pinned JAVA2D path; do not advertise exact bilinear
coordinates or high-quality area downsampling. Finite positive integer input dimensions
bound this mapping without a guessed artistic resource limit. Work/storage includes crop
copy and canvas raster; cache the result for display and later compositing.

## Focused validation before root acceptance

Use shared native lease and existing infrastructure, Java8 compilation and actual JAVA2D.
One standalone probe must distinguish:

- generated quadrant source: contain transparent margins versus cover clipping versus
  stretch; endpoints0/1 of alignment shift the exposed content on the affected axis;
- nonzero integer crop origin and crop isolation; source larger than output;
- alpha0 hidden blue/green invariance at enlarged red edges; RGB raw high-byte0 opaque;
- frame partly off canvas and wholly off canvas; transparent outside-frame pixels;
- source pixel immutability and independently owned returned outputs;
- bad crop bounds/overflow, zero extents, null fit/source, invalid alignment and density;
- one bounded720x480 placement to establish actual runtime use (no throughput claim).

Small exact full-coverage pixels prove selection and margins; native antialiased boundary
pixels are observed separately, not forced to a portable oracle. Test both axes using a
source with distinguishable colors and aspect ratios. Do not test only a square image.

Root authors/reviews an editable placement workflow next. It must reuse placed results
with existing masks/compositors and show a meaningful crop/fit edit. No automatic feature
extraction, rotated stamp recreation or distribution claim follows from the adapter probe.

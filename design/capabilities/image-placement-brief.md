# Image placement — root capability brief

Status: bounded investigation, not a frozen public signature or accepted operation.
Baseline: Java0.27, main2885324e8af65b124be64293085139cb990d12f6.

## Artist task and substitution points

Select a rectangle from a completed image or retained drawing, place it into a chosen
frame, then reuse the resulting transparent layer with regions, masks and crossfades.
Switch the source without rebuilding the partition layout; switch contain/cover behavior
without rewriting coordinate arithmetic. Cropping selects source content; fitting changes
its placement; masking controls visibility. These are separate decisions.

The helper removes repeated aspect-ratio fitting, alignment, source-crop isolation,
transparent output management and image-format handling. Ordinary Processing image calls
remain useful inside arbitrary drawing callbacks, but each composition currently repeats
these rules. A retained image result is compatible with Java2DLayers and Java2DRegions.

## Evidence and design divergence

eyes002 stamps one supplied photograph with varying scale, position and rotation; its
modularisation notes explicitly allow substituting image/draw callbacks. terrainCollage
places independently chosen images at noise-classified positions. Neither note establishes
contain/cover fitting, automatic source crops or a preferred sampling algorithm. Those are
project design dependencies for the maintainer's image/partition composition request.
The observed scale changes affect composition, but do not justify generic size defaults.
Photographic assets are not copied and no automatic eye extraction is claimed.

## Candidate behavior to resolve before implementation

- Completed density-one RGB/ARGB input; normalize RGB opacity without input mutation.
- Explicit integer source crop inside image bounds, half-open pixel-edge rectangle.
  Reject empty or out-of-bounds crop; do not silently pad or clamp a mistaken selection.
- Positive output canvas dimensions and explicit destination frame. Destination may extend
  outside the canvas; output clips to canvas. Source and destination dimensions are independent.
- Named CONTAIN preserves aspect and fits all crop content inside the frame; uncovered area
  stays transparent. COVER preserves aspect and fills the frame, clipping overflow to it.
  STRETCH fills the frame without preserving aspect, only when explicitly selected.
- Caller supplies horizontal/vertical alignment in[0,1]:0 start,0.5 center,1 end. It positions
  spare space for contain or selects which overflowing content survives cover. No hidden default.
- Return a detached transparent ARGB layer. Do not draw into or mutate a destination image;
  existing composite/crossfade functions remain responsible for mixing.
- Crop isolation: excluded neighboring pixels must not leak into sampled colors.
- Transparent-edge requirement: hidden RGB under alpha0 must not contaminate visible colors
  during scaling. Native sampling may be retained only if it meets that requirement under the
  declared runtime; otherwise specify a premultiplied sampler independently.
- No rotation or general affine signature in this first convenience; existing callback
  transforms remain available. Do not claim full recreation of rotated image-stamp sketches.

## Alternatives and implementation boundary

Existing RasterRemap2D computes straight-channel bilinear sampling with whole-image edge
clamping. It cannot silently change to premultiplied sampling; its accepted contract stays.
Using it for transparent fitting requires an explicit different computation, not a new alias.
Native JAVA2D image placement may instead be an adapter convenience reusing Java2DLayers
lifecycle and host rasterization, without adding a portable-operation claim. Root will choose
between these after a small native transparent-edge/crop experiment, not by API resemblance.

## Bounded acceptance and ownership

Root owns behavior, arithmetic/host-boundary choice and final review. Terra owns only the
private native sampling diagnostic until this brief becomes a frozen contract. Use existing
shared render lease, no parallel native rendering or new runner framework.

Private cases: opaque red beside alpha0 hidden blue/green/black; compare enlarged outputs;
then isolate a one-pixel crop beside an excluded opaque color and enlarge it. Record actual
intermediate ARGB values, input identity/pixels, runtime and source hashes. This tests whether
native machinery can supply the required behavior; it is not public acceptance.

After boundary selection, one editable workflow uses an independently generated source
with distinguishable quadrants and transparency. Compare contain, cover and explicit crop
in differently shaped frames, then pass the placed layer through the existing shape mask.
Acceptance must distinguish centering from alignment, crop isolation, transparent margins,
no hidden-color fringe, source immutability and retained save/recolor behavior. Tiny analytic
cases cover dimensions and failure preflight. No broad corpus/render matrix is required.

## Provenance bindings

- `survey/out/2017/Generativos/Eyes/eyes002/notes.md` SHA256 `b1f89e7d82335956d5faccc6c715151467b044ecfa5b0908734ae7c547ba1d45`
- `survey/out/2017/Generativos/terrainCollage/notes.md` SHA256 `0e71e207620245980bb287439d9f62ad8033832869d52e97b2e8c5a2acdb8794`

## Private result and root boundary decision

Pinned JAVA2D study completed at .work/image-placement-native-study1. Root inspected the
private diagnostic and verified all512 saved pixels for each variant: hidden blue, green
and black outputs are identical, all nonzero-alpha output RGB remains red, and the isolated
crop is opaque red throughout. Four boundary samples have alpha157,137,118,98 respectively
(actual precise values remain in result.json). This is positive evidence for native image
scaling, not a portable resampling contract or a minification-quality claim.

Proceed with a host-specific image-placement adapter using crop isolation plus native
JAVA2D scaling, reusing Java2DLayers.render for ownership and lifecycle. Public acceptance
still requires fit/alignment/clipping/format/error cases and an artist workflow. No new
portable sampler is justified by this study; RasterRemap2D remains unchanged.

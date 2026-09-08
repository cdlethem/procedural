# Reuse a mask across different drawings

Java workflow and native adapter review accepted; source-bundle packaging is pending.

MaskMarks creates its content images and mask once. Press M to switch between stripes
revealed by the mask, a picture revealed by the same mask, and a crossfade between the two.
Press V to inspect the mask and S to save the cached image.

Java2DLayers.render gives your callback an isolated, active PGraphics and returns a retained
transparent PImage. Draw with the supplied target's methods, then return. The adapter handles
begin/end drawing and resource cleanup; do not retain or dispose the borrowed target.
Keep simulation updates and random geometry generation outside a callback when they should
remain stable across redraws.

Java2DLayers.alphaMask reads the image's transparency into a reusable double array:

- Alpha0 produces mask0: no source contribution.
- Alpha255 produces mask1: full contribution.
- Intermediate alpha produces partial contribution, including native antialiased edges.

RGB does not affect this mask. Opaque black reveals just as opaque white does. The example's
black triangle has alpha128 and therefore contributes approximately half, rather than zero.
A black-and-white brightness mask is a different interpretation and is not inferred here.
The mask view displays transparency over gray; it is a view of the drawn image, not a graph
of numeric mask values.

Use Java2DLayers.composite to reveal a source over an existing destination. Use
Java2DLayers.crossfade to mix two contents: zero selects the first and one selects the
second. Both delegate their arithmetic to the portable raster operations. The same mask
can therefore reveal a picture, reveal marks or control a transition between them.

Replace the mask callback with your own native shapes or supply a completed image's alpha.
Input images must be density1 and matching dimensions for mixing. This facility preserves
Processing JAVA2D rasterization; it does not promise portable font metrics, mathematical
polygon clipping, automatic object detection or image fitting. Retain completed results
for display and export instead of rebuilding them every frame.

RGB images are treated as opaque; ARGB images preserve their alpha channel. ALPHA-only and
unknown Processing image formats are rejected explicitly. The adapter normalizes pixels in
detached buffers, leaving the original image values unchanged.

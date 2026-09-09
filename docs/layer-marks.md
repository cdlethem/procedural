# Composing content inside regions

Included in the accepted Java0.32 bundle; see the [CP29 distribution review](../evidence/distribution/cp29-java-review.json).

LayerMarks separates the partition layout from what is drawn inside it. Change the cuts to
change the layout; replace a content callback to change the drawing. The adapter provides
an isolated Processing drawing target and handles visibility and compositing.

Press M to cycle through four compositions, and S to save the cached image:

- Canvas content: neighboring regions reveal the same larger drawing without moving its
  coordinate origin.
- Local content: each callback starts at its region's top-left corner. This example combines
  an explicit image snippet with locally drawn lines.
- Feathered content: region edges fade into the existing background. Adjacent regions may
  expose a gutter; feathering does not automatically blend their contents into each other.
- Crossfade: two completed compositions mix through a horizontal weight field. At weight0
  the first image is selected; at1 the second is selected. Intermediate values blend both
  color and alpha using RasterCrossfade2D.

Java2DRegions uses rectangular regions in destination pixel units. CANVAS and LOCAL select
coordinate origins; neither implicitly scales content. Supply your own Region values or
convert a RetainedRectangles2D leaf snapshot with Java2DRegions.regions. Regions can contain
images, type or drawings from other operations through the same Content callback.

The callback receives an active borrowed PGraphics: use its drawing methods, then return.
Do not call beginDraw/endDraw/dispose or retain that target. Compute simulation updates and
random geometry explicitly before rendering if they should survive redraws. Each callback
runs once per supplied region in order; a failure returns no partial image and leaves the
input destination pixels unchanged. External side effects in your callback cannot be undone.

The example makes its source image in makeSource(). You can instead provide a loaded PImage
and choose its crop coordinates explicitly. The package does not recognize eyes or select
semantic image regions automatically. Its source image need not match the destination size,
but your drawing/crop placement must account for those dimensions.

The first adapter uses JAVA2D at pixel density1 and allocates temporary raster buffers.
Retain the returned image for display and export. Soft masks use encoded RGB with explicit
alpha handling; neither compositor claims linear-light color mixing. Ports, other renderers
and nonrectangular masks are separate capabilities.

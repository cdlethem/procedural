# Place an image inside a composition

Included in the accepted Java0.32 bundle; see the [CP29 distribution review](../evidence/distribution/cp29-java-review.json).

PlacementImageMarks separates selecting content from fitting it into a frame. The source
is a generated two-color picture, but a completed density-one RGB/ARGB PImage can replace
it. F cycles contain, cover and stretch; C selects a central crop; A cycles alignment;
M applies an ellipse mask; S saves the cached composition.

Contain preserves proportions and reveals the background in unused frame space. Cover
preserves proportions and clips the overflowing content. Stretch fills the frame by
changing proportions. Alignment chooses where spare space or overflow goes:0 is the
start edge,0.5 the center,1 the end edge. The example uses the same value on both axes;
you can choose horizontal and vertical alignment independently.

Crop uses integer source pixels. Frame uses destination canvas pixels. Their origins and
sizes are independent. Crop bounds must be inside the source; the destination frame may
extend off canvas. The adapter returns a transparent retained layer, ready to use with
Java2DLayers.composite or crossfade. In this example, changing the mask reuses the placed
image instead of recomputing its fit.

Java2DImagePlacement isolates the crop before native scaling, so neighboring source pixels
outside your selection cannot leak into it. RGB sources are opaque; ARGB preserves alpha.
Native JAVA2D image scaling is scoped to the pinned runtime at density1. This is not a
portable sampling contract, automatic image segmentation or an area-downsampling filter.
Keep completed layers for display and export rather than rebuilding them each frame.

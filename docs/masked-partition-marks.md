# Put replaceable content inside irregular windows

Java0.34 adds this workflow. See the [scoped native review](../evidence/workflows/masked-partition-marks/root-review.json)
for behavior and visual evidence. The source bundle is a development distribution.

MaskedPartitionMarks separates the layout, visibility masks and content. N moves the
partition between columns without regenerating source paths or images. M switches the
content between global paths, local line fans/rings and explicit image crops. 0 restores
the initial view; S saves the cached result.

The layout uses RetainedRectangles2D. Each rectangle supplies an ID and coordinate frame;
the example draws an ellipse inside it on a transparent layer, then obtains coverage with
Java2DLayers.alphaMask. A Java2DRegions.MaskedRegion captures that coverage once. Substitute
another drawn silhouette, including one with holes, without changing the content callback.
An opaque black image has full alpha coverage: draw transparency when preparing a mask.

Java2DRegions.renderMasked invokes the existing Content callback for each masked frame.
CANVAS reveals windows onto one larger drawing, retaining its coordinate continuity.
LOCAL translates to the frame's top-left corner without scaling. Masks always use destination
pixel coordinates. The supplied frame does not additionally clip the mask; it supplies
placement information and identity. Overlapping masks use ordered source-over composition.
Use Java2DLayers.crossfade separately for a two-image transition.

The generated source image can be replaced with your own completed PImage. This example
selects explicit pixel rectangles with get(); it does not recognize subjects or extract eyes
automatically. The callback can also draw retained geometry or ordinary Processing marks.
Keep source generation outside callbacks when edits should reuse the same drawing.

Masks are immutable snapshots: changing your original coverage array after construction
has no effect. Each mask retains eight bytes per canvas pixel, excluding headers. Four
720x480 masks retain about11MB, and rendering processes each full canvas. Reuse descriptors
and completed images for display rather than rebuilding every frame. This is JAVA2D at
pixel density one; no other-renderer or frame-rate guarantee is implied.

For the distinctions between visibility, placement and geometric constraints, see
[composing Java effects](composing-java-effects.md). Masking hides exterior strokes; it does
not make a path steer along a boundary or return clipped geometry.

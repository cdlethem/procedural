# Combine drawings, regions and image effects

A composition can start with something you already have: a set of paths, a layout of
regions, a finished drawing or a photograph. Keep that result, then try different ways to
place, color, crop or blend it.

## Choose what the boundary should do

| What you want to see | Use | What happens |
| --- | --- | --- |
| One drawing visible through several windows | [LayerMarks](layer-marks.md) or [MaskedPartitionMarks](masked-partition-marks.md) | Each window reveals its part of a larger picture. |
| A separate drawing inside each region | [LayerMarks](layer-marks.md) | Your drawing starts at each region’s top-left corner. |
| A picture fitted inside a frame | [PlacementImageMarks](placement-image-marks.md) | Crop, fit and align the picture independently of the frame. |
| A drawing revealed through an irregular shape | [MaskMarks](mask-marks.md) | Transparency controls where the picture appears. |
| Line segments trimmed to an outline | [ClipMarks](clip-marks.md) or [PathClipMarks](path-clip-marks.md) | You get the visible pieces of each line, ready to draw or decorate. |
| Strokes that stop when they meet another line | [ContactMarks](contact-marks.md) | Each stroke ends at the first obstacle it reaches. |
| Lines bent around circular areas | [ProjectionMarks](projection-marks.md) | Points move; the drawing follows their new positions. |

Hiding part of a path does not change how it travels. If you need the whole painted stroke
to stay inside a shape, use a mask: clipping the line’s center still allows a thick stroke
or a large endpoint dot to cross the edge.

## Fill regions with your own drawing

Choose the layout first, then supply a drawing function for the contents. The function
receives `target`, the surface to draw on, and `region`, the rectangle being filled.
For example, alternate between two finished images:

```java
Java2DRegions.Content content = (target, region) -> {
    target.image(region.id % 2 == 0 ? firstDrawing : secondDrawing, 0, 0);
};
PImage composed = Java2DRegions.render(this, backgroundImage, regions,
    Java2DRegions.Space.CANVAS, 0, content);
```

Here the images are already prepared at the canvas size, and `regions` contains the
rectangles to reveal. Keep finished images outside the drawing function so changing the
layout does not regenerate them.

| Choice | How the content is placed |
| --- | --- |
| `Space.CANVAS` | All regions look onto the same full-canvas drawing. Lines can continue across neighboring windows. |
| `Space.LOCAL` | `(0, 0)` becomes the top-left of each region, so each window can have its own composition. |
| Feather amount | Softens the region’s edge instead of cutting it sharply. |

Local placement moves the origin; it does not resize your drawing. Use
`region.right - region.left` and `region.bottom - region.top` for the region’s dimensions.
Draw through `target` without calling `beginDraw()` or `endDraw()`; the library manages
that surface. For irregular windows, use `Java2DRegions.renderMasked` as shown in
[MaskedPartitionMarks](masked-partition-marks.md).

## Blend one picture into another

A mask specifies how much of a picture shows at each pixel. It can have hard edges,
soft edges or a gradual transition across the whole canvas.

| Method | Visual result |
| --- | --- |
| `Java2DLayers.composite` | Place a picture over a background. Transparent parts let the background show through. |
| `Java2DLayers.crossfade` | Move between two equal-sized pictures. A weight of 0 shows the first, 1 shows the second, and values between them mix the two. |
| `Java2DLayers.alphaMask` | Use a drawing’s transparency as the shape that reveals another picture. |

For transparency masks, black and white behave alike when both are opaque. Draw transparent
areas where you want to hide the picture and partly transparent areas for softer edges.
Feathering two neighboring windows can leave a gap; use a crossfade when you want a continuous
transition between two finished effects.

[BlurMarks](blur-marks.md) blends a sharp drawing into a softened version from left to right.
Replace either image with a different effect while keeping the same transition.

## Order changes the picture

| Sequence | What you see |
| --- | --- |
| Draw a field, then reveal it through windows | Pieces of one continuous pattern. |
| Draw a field separately in each window | A new pattern starting within each region. |
| Blur a full drawing, then mask it | The boundary stays sharp, but colors just outside it can soften the visible interior. |
| Mask a drawing, then blur it | The soft image can spread beyond the original boundary. Mask again to trim that spread. |
| Crop an image, then blur it | The blur uses the crop’s edges, not neighboring parts of the original image. |
| Bend paths, then draw them | Marks follow the changed paths, which remain available for further drawing. |
| Draw paths, then warp the picture | All painted pixels move together, including colors and line widths. |

## Use an image to guide new marks

[ImageFieldMarks](image-field-marks.md) reads an image at a grid of positions and uses the
values to choose dot sizes, colors or visibility. The image becomes a guide for a new
drawing rather than just a picture placed on the canvas.

Start with a fixed layout, change the input image, then try a different mark. The example’s
brightness value uses the largest red, green or blue channel; transparency is separate.
If transparent areas should have no marks, use the sampled alpha as well.

For keeping larger compositions responsive, see [Java performance guidance](java-performance.md).

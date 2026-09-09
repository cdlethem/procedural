# Place an image inside a composition

It places a two-color source image in a frame, showing the difference between preserving
proportions, filling the frame, and stretching the image.

[Install the Java library](building-java-from-source.md), then open **PlacementImageMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| F | Cycle between showing the whole image, filling the frame by cropping, and stretching to fit. |
| C | Toggles a central source crop. |
| A | Move the image toward the start, center or end of its frame. |
| M | Toggles an ellipse mask over the placed image. |
| S | Saves the displayed image. |

Replace the generated source with a completed RGB or ARGB `PImage`. Choose source crop pixels
and destination frame separately. Contain leaves background around a proportion-preserving
image; cover fills the frame and hides overflow; stretch changes proportions. You can choose
horizontal and vertical alignment independently in your own composition.

Crop bounds must stay inside the source, while a destination frame may extend off canvas. RGB
sources are opaque and ARGB sources keep transparency. The optional mask reuses the placed
layer; it does not change the image fit. Use JAVA2D and `pixelDensity(1)` for this example. See
[composing Java effects](composing-java-effects.md) for more image-placement examples.

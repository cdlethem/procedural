# Soften a drawing

It draws one translucent arrangement, then shows it sharp, softened in both directions, blurred
horizontally, or blurred vertically. You can place or blend the softened image elsewhere in a
composition.

[Install the Java library](building-java-from-source.md), then open **BlurMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| M | Cycles sharp, soft, horizontal, and vertical layers. |
| B | Blends the selected layer with the sharp drawing from left to right. |
| S | Saves the displayed image. |

Replace the initial drawing with a completed RGB or ARGB image. Use separate horizontal and
vertical weight arrays to choose the direction of spread; a one-value `[1]` axis has no spread.
Filter a full drawing before a later crop when neighboring content should soften together.
Filter an isolated crop when its own edges should stay separate.

Blur uses clamped edge samples, so edge colors continue outward. Keep the filtered images so
changing how they are blended does not repeat the blur. For the filter settings and work
limits, see the [separable blur API](../catalog/operations/separable-blur-2d.json) and [Java
performance guidance](java-performance.md).

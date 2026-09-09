# Compose content inside regions

It divides a canvas into rectangles and fills them with one continuous picture, local crops and
lines, softened edges, or a blend between two completed layouts.

[Install the Java library](building-java-from-source.md), then open **LayerMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| M | Cycles canvas content, local content, feathered local content, and a crossfade. |
| S | Saves the displayed image. |

Replace `makeSource()` with a completed image, or replace either drawing function with your own
drawing. Canvas content keeps the same coordinate origin across regions. Local content starts
at each region's top-left corner. Supply your own regions to change the arrangement; choose
image crop placement explicitly.

Feathering can leave a gutter between adjacent regions. A crossfade makes one finished image
gradually give way to another, including their transparency. The drawing function receives a
temporary drawing target: use its drawing methods but do not retain it or call `beginDraw`,
`endDraw`, or `dispose`. This example uses rectangular JAVA2D regions at `pixelDensity(1)`.
Keep completed images for display and export; see [composing Java
effects](composing-java-effects.md) for more examples.

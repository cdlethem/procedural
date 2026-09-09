# Put replaceable content inside irregular windows

The sketch shows a drawing through several irregular windows. You can switch from one
continuous image to local fans and rings, or to explicit image crops.

[Install the Java library](building-java-from-source.md), then open **MaskedPartitionMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| M | Cycles continuous canvas content, local marks, and image crops. |
| N | Change the window shapes and positions while keeping the selected type of content. |
| 0 | Restores the starting layout and content. |
| S | Saves the displayed image. |

Replace the window drawing with any transparent silhouette, including one with holes, and
replace the drawing function with your own completed image or marks. Canvas content keeps one
coordinate system across windows. Local content starts at each window's top-left corner. Choose
crop rectangles explicitly when using an image.

Masking uses transparency: opaque black reveals as fully as opaque white. It hides exterior
pixels; it does not return clipped paths or make movement avoid a boundary. Masks are saved
copies, so rebuild a mask after changing its source drawing. The example uses JAVA2D at
`pixelDensity(1)` and processes full-canvas images; reuse completed masks and images between
edits. See [composing Java effects](composing-java-effects.md) for more composition examples.

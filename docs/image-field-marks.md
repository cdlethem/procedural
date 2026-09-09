# Let an image control the marks

A fixed grid becomes dots whose size or visibility follows a sampled image. Switching the image
changes the field while keeping the same grid.

[Install the Java library](building-java-from-source.md), then open **ImageFieldMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| M | Switch between larger dots in darker areas and fixed-size dots shown only in darker areas. |
| I | Change the source image, reshaping the dot pattern without moving the grid. |
| C | Switches plain and sampled image colors. |
| S | Saves the displayed image. |

Replace a generated source with a completed RGB or ARGB image. Fit it to the canvas first when
its dimensions differ, then sample it at the grid positions. Keep sampled values when only
changing mark style; sample it again after changing the image.

Brightness here is the largest RGB channel, not weighted luminance. Alpha is separate:
transparent white can still have high brightness. Decide explicitly whether alpha should alter
dot size or visibility in your own piece. Sampling outside an image uses its edge color. This
is an image-value field, not automatic feature recognition or image fitting. See [Java
performance guidance](java-performance.md) for larger drawings.

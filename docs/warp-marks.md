# Bend a finished drawing

WarpMarks bends a dot or stripe pattern into flowing shapes. It works on the finished
image, so the marks, their colors and their widths distort together.

[Install the Java library](building-java-from-source.md), then open **WarpMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **W** | Cycle distortion strength through 32, 64 and 0; zero shows the original pattern. |
| **F** | Switch between a noise-driven warp and a repeating wave-based warp. |
| **P** | Switch the original drawing between dots and stripes. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Replace the source-pattern drawing with your own image, then change the displacement
field to decide where pixels are sampled from. `RasterRemap2D` builds the resulting image.
A displacement asks where to read the original image for each output pixel; it does not
move the original path geometry.

| Choice | Visible effect |
| --- | --- |
| Source image | The material being bent: dots, stripes, a photograph or another drawing. |
| Displacement strength | How far sampling moves from each pixel’s original position. |
| Field pattern | Where the image stretches, compresses and turns. |

Keep the source image while comparing warps. At the image edges, sampling repeats edge
colors rather than creating new content. Use a mask afterward if only part of the canvas
should show the effect.

# RampMarks: place the color transitions

The Java core and native JAVA2D workflow have passed root review. RampMarks is included
in the Java0.17 source bundle. Distribution review records identify accepted archive bytes.
Open examples/RampMarks/RampMarks.pde after installing that bundle. Java0.16 lacks this operation.

RampMarks keeps every circle in place while changing where colors transition. A StopRamp
pairs each supplied RGB color with a normalized scalar position. Move a stop to lengthen
one transition and shorten its neighbor. Unlike CyclicPalette, the ramp neither spaces
all colors evenly nor wraps the last color back to the first.

| Key | Edit |
| --- | --- |
| T | Move the first interior stop between .25 and .6. |
| C | Replace the colors without changing stop positions or circles. |
| F | Use distance from the center instead of horizontal progress; reuse the same ramp. |
| 0 | Restore the initial colors, stops and horizontal progress. |
| S | Save the retained display to ramp-marks.png without redrawing. |

The example starts with stops at 0, .25, .8 and 1. These are authored settings, not measured
recommended ranges. Replace the arrays in rebuildRamp() to make your own progression.
Positions must increase strictly within [0,1]; duplicate positions are rejected. Queries
outside the first/last positions hold those endpoint colors. A single stop is constant.

Colors are opaque RGB24 integers such as 0x173F5F. To supply a Processing color() value,
mask it with `& 0xFFFFFF`; choose opacity separately in drawing. Interpolation operates
on encoded RGB8 channels, with no perceptual-space or gamma conversion. The sampler
returns colors and does not draw, generate a field, or own a random stream.

The [colorRamp report](../survey/out/2016/Generativos/colorRamp/notes.md) describes
positioned color sampling independently of its warp. [boxDepth](../survey/out/2016/Generativos/boxDepth/notes.md)
supplies unequal stops for noise-colored boxes; [celular](../survey/out/2016/Generativos/celular/notes.md)
uses fixed unequal intervals for radial colors. The palette edit in
[triangleRamp](../survey/out/2016/Generativos/triangleRamp/notes.md) also changes random-stream
consumption and geometry, so it does not establish a recommended stop-spacing range.
This example demonstrates the sampling mechanism, not a recreation of those whole sketches.

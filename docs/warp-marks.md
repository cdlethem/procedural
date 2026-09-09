# WarpMarks: bend a captured pattern

Build the Java0.16 source bundle using [the installation guide](building-java-from-source.md).
The JAVA2D workflow has scoped native acceptance; each distribution build requires its own
extracted-consumer validation. Earlier Java0.15 bundles do not contain this example.

`WarpMarks` draws a small pattern once, then remaps its pixels through an explicit
source-coordinate field. The source pixel buffer is copied before remapping. Changing
the field or displacement strength reuses that unchanged buffer; changing the pattern
recaptures it. `RasterRemap2D` owns the detached result and performs straight-channel
ARGB8 bilinear sampling with whole-coordinate edge clamping. Straight-channel filtering
can expose hidden RGB from transparent source pixels at translucent edges; this is
deliberate contract behavior, not premultiplied compositing.

Open the `WarpMarks` example in Processing 4. It uses a 640×640 JAVA2D surface at
`pixelDensity(1)`. The default is the 24-pixel colored-dot pattern with a seeded gradient
noise angle field and displacement strength 32. The source pattern, field expressions,
and strengths are authored example choices, not library defaults or recommended ranges.

| Key | Edit |
| --- | --- |
| `W` | Cycle displacement strength 0, 32, 64. |
| `F` | Switch between the seeded gradient-noise field and an analytic sinusoidal field. |
| `P` | Replace the dots with colored horizontal stripes; the next field edit reuses them. |
| `0` | Restore the default dot pattern, noise field, and strength 32. |
| `S` | Save the retained displayed image as `warp-marks.png` without redrawing. |

The gradient field uses seed 42 and samples the existing `GradientNoise2D01` operation;
the second field uses independent sine waves with period 160 pixels. Both are example
coordinate generators. The colorRamp survey supplies technique-level evidence for
pull-sampling and bilinear reconstruction (see
`survey/out/2016/Generativos/colorRamp/notes.md`); this starter does not claim to recreate that
whole sketch or its palette, grain, shadows, or Processing image behavior.

The core receives packed ARGB8 pixels and explicit coordinates, never a Processing
`PImage`, callback, renderer, noise object, or mutable source. Exact integer coordinates
preserve all four channels, including hidden RGB in transparent pixels. Finite source
coordinates are clamped to the source's center bounds before four-tap interpolation.

## Supply coordinates for your own image mapping

For the typed `RasterRemap2D.remap` overload, `packedXY` has two values for every output
pixel in row-major order. For output `(x,y)`, the pair beginning at
`2 * (y * outputWidth + x)` is `[sourceX, sourceY]`. Coordinates use source pixel centers:
`(0,0)` addresses the first pixel and `(sourceWidth-1,sourceHeight-1)` the last. This is a
pull map: specify where each output pixel reads from, rather than where a source pixel moves.

Sampling clamps to the source edges. Bilinear interpolation treats straight ARGB channels
independently; it is neither premultiplied-alpha nor linear-light filtering. This differs
from the premultiplied blending used by the composition operations. Keep that distinction
when remapping partly transparent images.

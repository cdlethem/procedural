# WarpMarks native acceptance plan

Scope: CP13 raster.bilinear-remap-2d, Processing 4.5.6 JAVA2D, 640×640,
pixelDensity(1), opaque authored source patterns, library GradientNoise2D01 seed42.
This is technique-level reconstruction of colorRamp's active pull-raster warp, not an
original-sketch recreation or Processing lerpColor pixel-compatibility claim. Root read
survey/out/2016/Generativos/colorRamp/notes.md and the pinned source identified in
cp13-raster-admission.md. No assets, fonts, shaders or animation are required.

Before acceptance, pass the shared exact core vectors through both Java entrypoints,
review numeric/ownership failures and observe bounded fractional-sampling performance.
Then preprocess the actual shipped PDE with the official preprocessor, compile it against
a freshly source-built candidate JAR, and execute that PDE in native JAVA2D under the
machine-wide render lock. Bind sources, JAR, compiled code and runtime to the result.
A candidate JAR does not establish released-package installation acceptance.

Seven completed display states, in this order, via injected Processing key events:

1. Baseline: dots, noise-angle field, strength32.
2. W: strength64, same source object and unchanged source pixels; changed display.
3. W: strength0, same source; exact displayed/source pixel identity.
4. W: strength32, same source; exact baseline display restoration.
5. F: sinusoidal field, same source; changed display with visible bent dot rows.
6. P: stripes, sinusoidal field; new source capture and changed display.
7. 0: reset to dots/noise/strength32; exact baseline display restoration.

S then saves the retained display without another draw. Observe at least300ms quiet,
verify saved PNG pixels equal final display pixels, and require seven draws total.
Each actual display must be640-square, opaque and nonblank. Verify renderer class and
density; compare cached PImage pixels with the actual PApplet framebuffer after draw.
No physical keyboard automation is claimed by injected key events.

Root inspects baseline, zero, sinusoidal dots and warped stripes. Acceptance requires
recognizable pattern structure, visible field/strength edits, and no unexpected blank
bands or transport corruption. Edge repetition is expected from the documented clamp.
Retain measurements and failures; do not weaken criteria after inspecting results.

The source's random dots, color ramp, shadows and grain are deliberately replaced by
simple authored patterns that expose resampling clearly. Portable noise differs from host
Processing noise. Single final channel quantization differs from nested host color lerps.
Original baseline similarity is therefore not a success criterion or coverage credit.
Ports, translucent native transport and other renderers remain unclaimed. Extracted Java
package execution and final guide/catalog/support synchronization remain separate gates.

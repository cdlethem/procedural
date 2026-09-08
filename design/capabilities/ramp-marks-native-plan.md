# RampMarks native acceptance plan

CP14 color.stop-ramp, Processing4.5.6 JAVA2D at640×640, density1, opaque colors.
Technique-level stop placement and scalar-transfer workflow; no original-sketch recreation.
Use actual preprocessed RampMarks.pde and source-built Java core. Core fixture/ownership
review must pass first. All native execution uses the shared machine lease.

Five completed display states via injected Processing key events:

1. baseline: horizontal progress, stops0/.25/.8/1, initial colors.
2. T: first interior stop .6, other stops/colors and geometry unchanged.
3. C: alternate colors, same shifted positions and geometry.
4. F: radial progress, identical retained StopRamp instance to state3 and unchanged geometry.
5. 0: reset positions, colors and scalar coordinates; display pixel-equal to baseline.

Then S saves ramp-marks.png without redraw. Observe at least300ms quiet; total draws5,
keys tcf0s. Decode the saved file and compare its pixels exactly with final display.
Native probe must confirm actual JAVA2D renderer/density,640-square opaque nonblank output,
and cached/framebuffer equality. Observe ellipse calls:729 circles per draw, identical
ordered x/y/width/height stream across all states. This proves geometry retention without
assuming a color-dependent antialias mask is unchanged. The T/C edits construct a new ramp;
F retains the same ramp object; reset constructs the baseline descriptor anew.

Capture each actual framebuffer. Root inspects baseline, shifted stops, recolor and radial
transfer. Require visible color progression and band-width/location change, plus circular
progression in radial mode. All three edits must change display pixels; resets must match.
Source parameters are authored demonstration values, not recommended ranges. No threshold
may be weakened after rendering to conceal a semantic or transport failure.

Bind source, probe, runtime and actual loaded JAR. Reuse existing source-bundle generation
and extracted-consumer validation; preserve earlier accepted class/example/font payloads.
Other renderers, opacity interpolation, host lerpColor equality and ports remain unclaimed.

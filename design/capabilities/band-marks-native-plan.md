# BandMarks native acceptance plan — CP15

Pre-render plan for the public NoiseBandPath2D workflow. Java-first; all other targets
remain unvalidated. This is technique-level validation, not whole-venas recreation.
Use existing registered starter runner/probe conventions and the shared machine lease.

## Editable piece

640x640 JAVA2D, density1, fixed8x8 starting grid at40+80*i in each dimension. One public
trace per start,2048 attempts, unit step, heading0, field seed0x6a09e667, scale.006 and
offset(7.3,11.7). Explicit per-trace seed=1000+gridIndex; no host randomness. maxVertices2049
admits the full attempted count. These are authored example values, not recommendations.

Retain64 path objects. Draw subpixel polylines including each starting vertex and first
accepted segment. Use an explicit palette and opaque background. Changing the palette must
preserve path identities and exact coordinates/headings/counters. A perpendicular-mark view
uses retained accepted headings, sampling every eighth accepted segment at its endpoint;
mark length is an authored drawing choice. This demonstrates a different mark without
reimplementing acceptance, resampling fields or regenerating paths.

Keys and five states: baseline, wider, recolored, marks, reset; injected sequence tcm0s.
T changes tolerance.002→.008 and rebuilds paths; C changes palette only; M switches drawing
from polylines to perpendicular marks;0 restores initial tolerance/palette/mark mode and
rebuilds. S saves the retained displayed image without an extra draw. README/guide explains
attempts versus accepted moves and why wider tolerance changes trajectories, not merely width.

## Required checks

- Actual shipped PDE, public JAR code source, Processing renderer,640² and density1.
- Five draw states, ordered events, all images nonblank and opaque; cached image equals
  framebuffer. Saved PNG equals final display after >=300ms without an extra draw.
- All64 paths report attempts2048, size=accepted+1, headings count=accepted and
  accepted+rejected=attempts. No path exceeds2049 vertices.
- Record aggregate accepted/rejected counts and exact geometry/heading hashes for each state.
  T changes geometry; C and M preserve the actual path objects and hashes; reset restores
  baseline values/pixels. Style and mark changes must visibly change output.
- Root inspect baseline, wider, recolored and marks. The first two must show meaningful
  confined versus wider/tangled paths; the mark view must remain legible as a distinct use.
- Compile all extracted starters, run BandMarks from the extracted JAR, and compare its
  five frames plus saved output to reviewed candidate pixels. Preserve prior package payloads.

Core performance and semantic errors are covered separately. Do not render a ten-million-
attempt source scene merely to measure its core workload. No physical-keyboard, P2D,
closed-contour, analytic-field callback or new original-recreation claim follows from this plan.
